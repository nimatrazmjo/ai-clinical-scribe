import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityModule } from '../identity/identity.module';
import { SecretsModule } from '../../secrets/secrets.module';
import { SystemClock } from '../../shared-kernel/implementations/system-clock';
import { CLOCK } from '../../shared-kernel/tokens';
import { JwtTokenService } from './jwt-token.service';
import { TOKEN_SERVICE } from './token-service.port';
import { LoginUseCase } from './login.use-case';
import { AuthController } from './auth.controller';

@Module({
  imports: [IdentityModule, SecretsModule, JwtModule.register({})],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    LoginUseCase,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
