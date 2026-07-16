import { Module } from '@nestjs/common';
import { EnvSecretsProvider } from './env-secrets-provider';
import { SECRETS_PROVIDER } from './secrets-provider.port';

@Module({
  providers: [
    {
      provide: SECRETS_PROVIDER,
      useClass: EnvSecretsProvider,
    },
  ],
  exports: [SECRETS_PROVIDER],
})
export class SecretsModule {}
