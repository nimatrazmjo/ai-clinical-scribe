import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TOKEN_SERVICE } from '../token-service.port';
import type { TokenVerifyResult } from '../token-service.port';
import { UserRole } from '../../identity/user.entity';
import type { UserEntity } from '../../identity/user.entity';
import { MissingTokenException } from '../exceptions/missing-token.exception';
import { TokenExpiredException } from '../exceptions/token-expired.exception';
import { InvalidTokenException } from '../exceptions/invalid-token.exception';
import { AccountDeactivatedException } from '../exceptions/account-deactivated.exception';

const activeUser: UserEntity = {
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

function buildCtx(authHeader?: string): ExecutionContext {
  const req: Record<string, unknown> = {};
  if (authHeader !== undefined) {
    req['headers'] = { authorization: authHeader };
  } else {
    req['headers'] = {};
  }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let verifyMock: jest.Mock<Promise<TokenVerifyResult>>;
  let findByIdMock: jest.Mock;

  beforeEach(() => {
    verifyMock = jest.fn();
    findByIdMock = jest.fn();

    guard = new JwtAuthGuard(
      { sign: jest.fn(), verify: verifyMock } as never,
      { findById: findByIdMock, findByEmail: jest.fn(), save: jest.fn() } as never,
    );
  });

  it('throws MissingTokenException when Authorization header is absent', async () => {
    await expect(guard.canActivate(buildCtx())).rejects.toBeInstanceOf(
      MissingTokenException,
    );
  });

  it('throws MissingTokenException when header does not start with Bearer', async () => {
    await expect(
      guard.canActivate(buildCtx('Basic dXNlcjpwYXNz')),
    ).rejects.toBeInstanceOf(MissingTokenException);
  });

  it('throws TokenExpiredException for an expired token', async () => {
    verifyMock.mockResolvedValue({ status: 'expired' });
    await expect(
      guard.canActivate(buildCtx('Bearer expired.token')),
    ).rejects.toBeInstanceOf(TokenExpiredException);
  });

  it('throws InvalidTokenException for a malformed token', async () => {
    verifyMock.mockResolvedValue({ status: 'invalid' });
    await expect(
      guard.canActivate(buildCtx('Bearer bad.token')),
    ).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('throws InvalidTokenException when sub does not match any user', async () => {
    verifyMock.mockResolvedValue({
      status: 'ok',
      payload: {
        sub: 'ghost',
        email: 'x@x.com',
        role: 'provider',
        iat: 0,
        exp: 9999999999,
      },
    });
    findByIdMock.mockResolvedValue(null);
    await expect(
      guard.canActivate(buildCtx('Bearer valid.token')),
    ).rejects.toBeInstanceOf(InvalidTokenException);
  });

  it('throws AccountDeactivatedException when user is inactive', async () => {
    verifyMock.mockResolvedValue({
      status: 'ok',
      payload: {
        sub: 'u-1',
        email: activeUser.email,
        role: 'provider',
        iat: 0,
        exp: 9999999999,
      },
    });
    findByIdMock.mockResolvedValue({ ...activeUser, isActive: false });
    await expect(
      guard.canActivate(buildCtx('Bearer valid.token')),
    ).rejects.toBeInstanceOf(AccountDeactivatedException);
  });

  it('returns true and attaches user to request for a valid active token', async () => {
    verifyMock.mockResolvedValue({
      status: 'ok',
      payload: {
        sub: 'u-1',
        email: activeUser.email,
        role: 'provider',
        iat: 0,
        exp: 9999999999,
      },
    });
    findByIdMock.mockResolvedValue(activeUser);
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid.token' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req['user']).toBe(activeUser);
  });
});
