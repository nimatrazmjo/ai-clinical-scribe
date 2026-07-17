import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type PasswordHasher,
  PASSWORD_HASHER,
} from '../identity/password-hasher.port';
import { UserRepository } from '../identity/user.repository';
import { type TokenService, TOKEN_SERVICE } from './token-service.port';
import { InvalidCredentialsException } from './exceptions/invalid-credentials.exception';
import { AuditRepository } from '../audit/audit.repository';

export interface LoginCommand {
  email: string;
  password: string;
}

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    private readonly audit: AuditRepository,
  ) {}

  async execute(cmd: LoginCommand): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(cmd.email);

    if (!user) {
      throw new InvalidCredentialsException();
    }

    const valid = await this.hasher.verify(cmd.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsException();
    }

    if (!user.isActive) {
      this.logger.warn(`Login attempt for deactivated user: ${user.id}`);
      throw new InvalidCredentialsException();
    }

    const accessToken = await this.tokenService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'USER_AUTHENTICATED',
      entityType: 'user',
      entityId: user.id,
      metadata: {},
    });

    return { accessToken };
  }
}
