import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../identity/user.entity';
import type { UserEntity } from '../../identity/user.entity';

const providerUser: UserEntity = {
  id: 'u-1',
  email: 'doc@clinic.com',
  role: UserRole.PROVIDER,
  firstName: 'Doc',
  lastName: 'Test',
  passwordHash: 'hash',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildCtx(user: UserEntity): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('returns true when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(buildCtx(providerUser))).toBe(true);
  });

  it('returns true when user role matches required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.PROVIDER]);
    expect(guard.canActivate(buildCtx(providerUser))).toBe(true);
  });

  it('returns true when required roles include ADMIN and user is ADMIN', () => {
    const adminUser = { ...providerUser, role: UserRole.ADMIN };
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(buildCtx(adminUser))).toBe(true);
  });

  it('throws ForbiddenException when provider hits admin-only route (E-08)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(buildCtx(providerUser))).toThrow(
      ForbiddenException,
    );
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
