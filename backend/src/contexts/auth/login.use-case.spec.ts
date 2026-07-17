import { Logger } from '@nestjs/common';
import { LoginUseCase } from './login.use-case';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import type { UserRepository } from '../identity/user.repository';
import type { PasswordHasher } from '../identity/password-hasher.port';
import type { TokenService } from './token-service.port';
import type { UserEntity } from '../identity/user.entity';
import { UserRole } from '../identity/user.entity';

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-id-1',
    email: 'dr.test@demo.clinic',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.PROVIDER,
    passwordHash: 'hashed-pw',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let users: jest.Mocked<UserRepository>;
  let hasher: jest.Mocked<PasswordHasher>;
  let tokenService: jest.Mocked<TokenService>;
  let loggerWarn: jest.SpyInstance;

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;
    hasher = {
      hash: jest.fn(),
      verify: jest.fn(),
    };
    tokenService = {
      sign: jest.fn().mockResolvedValue('token.abc'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;
    loggerWarn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    useCase = new LoginUseCase(users, hasher, tokenService);
  });

  afterEach(() => {
    loggerWarn.mockRestore();
  });

  it('returns accessToken for valid credentials', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    hasher.verify.mockResolvedValue(true);

    const result = await useCase.execute({
      email: 'dr.test@demo.clinic',
      password: 'pass',
    });

    expect(result).toEqual({ accessToken: 'token.abc' });
    expect(tokenService.sign).toHaveBeenCalledWith({
      sub: 'user-id-1',
      email: 'dr.test@demo.clinic',
      role: UserRole.PROVIDER,
    });
  });

  it('throws InvalidCredentialsException for unknown email', async () => {
    users.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'unknown@demo.clinic', password: 'pass' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsException for wrong password', async () => {
    users.findByEmail.mockResolvedValue(makeUser());
    hasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'dr.test@demo.clinic', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(tokenService.sign).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentialsException for deactivated user', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));
    hasher.verify.mockResolvedValue(true);

    await expect(
      useCase.execute({ email: 'dr.test@demo.clinic', password: 'pass' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('logs user id (not email or password) for deactivated user', async () => {
    users.findByEmail.mockResolvedValue(makeUser({ isActive: false }));
    hasher.verify.mockResolvedValue(true);

    await expect(
      useCase.execute({ email: 'dr.test@demo.clinic', password: 'secret' }),
    ).rejects.toThrow();

    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const msg = String(loggerWarn.mock.calls[0][0]);
    expect(msg).toContain('user-id-1');
    expect(msg).not.toContain('secret');
    expect(msg).not.toContain('dr.test@demo.clinic');
  });

  it('invalid credentials exception has status 401 and code INVALID_CREDENTIALS', () => {
    const ex = new InvalidCredentialsException();
    expect(ex.statusCode).toBe(401);
    expect(ex.code).toBe('INVALID_CREDENTIALS');
  });
});
