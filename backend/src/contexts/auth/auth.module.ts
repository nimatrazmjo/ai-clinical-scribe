import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityModule } from '../identity/identity.module';
import { SecretsModule } from '../../secrets/secrets.module';
import { AuditModule } from '../audit/audit.module';
import { SystemClock } from '../../shared-kernel/implementations/system-clock';
import { CLOCK } from '../../shared-kernel/tokens';
import { JwtTokenService } from './jwt-token.service';
import { TOKEN_SERVICE } from './token-service.port';
import { LoginUseCase } from './login.use-case';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [IdentityModule, SecretsModule, JwtModule.register({}), AuditModule],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    LoginUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [JwtAuthGuard, RolesGuard, TOKEN_SERVICE, IdentityModule],
})
export class AuthModule {}
