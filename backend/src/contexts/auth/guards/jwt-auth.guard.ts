import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TOKEN_SERVICE } from '../token-service.port';
import type { TokenService } from '../token-service.port';
import { UserRepository } from '../../identity/user.repository';
import { TokenExpiredException } from '../exceptions/token-expired.exception';
import { InvalidTokenException } from '../exceptions/invalid-token.exception';
import { MissingTokenException } from '../exceptions/missing-token.exception';
import { AccountDeactivatedException } from '../exceptions/account-deactivated.exception';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user: unknown }>();

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new MissingTokenException();
    }

    const token = authHeader.slice(7);
    const result = await this.tokenService.verify(token);

    if (result.status === 'expired') {
      throw new TokenExpiredException();
    }

    if (result.status === 'invalid') {
      throw new InvalidTokenException();
    }

    const user = await this.userRepository.findById(result.payload.sub);

    if (!user) {
      throw new InvalidTokenException();
    }

    if (!user.isActive) {
      throw new AccountDeactivatedException();
    }

    req.user = user;
    return true;
  }
}
