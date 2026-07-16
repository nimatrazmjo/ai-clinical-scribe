import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CLOCK } from '../../shared-kernel/tokens';
import { SECRETS_PROVIDER } from '../../secrets/secrets-provider.port';
import type { Clock } from '../../shared-kernel';
import type { SecretsProvider } from '../../secrets/secrets-provider.port';
import type { TokenService } from './token-service.port';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(SECRETS_PROVIDER) private readonly secrets: SecretsProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async sign(payload: {
    sub: string;
    email: string;
    role: string;
  }): Promise<string> {
    const secret = await this.secrets.get('JWT_SECRET');
    const nowMs = this.clock.now().getTime();
    const iat = Math.floor(nowMs / 1000);
    const exp = Math.floor((nowMs + EIGHT_HOURS_MS) / 1000);
    return this.jwtService.signAsync({ ...payload, iat, exp }, { secret });
  }
}
