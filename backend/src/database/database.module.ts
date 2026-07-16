import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SecretsModule } from '../secrets/secrets.module';
import {
  SECRETS_PROVIDER,
  SecretsProvider,
} from '../secrets/secrets-provider.port';
import { EnablePgcrypto1000000000000 } from './migrations/1000000000000-EnablePgcrypto';

export const DATA_SOURCE = 'DATA_SOURCE';

@Module({
  imports: [SecretsModule],
  providers: [
    {
      provide: DATA_SOURCE,
      inject: [SECRETS_PROVIDER],
      useFactory: async (secrets: SecretsProvider): Promise<DataSource> => {
        const url = await secrets.get('DATABASE_URL');
        const ds = new DataSource({
          type: 'postgres',
          url,
          synchronize: false,
          poolSize: 10,
          migrationsTableName: 'migrations',
          migrations: [EnablePgcrypto1000000000000],
        });
        // Connection failures are surfaced via the health endpoint (db:'down'),
        // not by crashing the app at boot. Missing DATABASE_URL does fail fast (E-41).
        try {
          await ds.initialize();
        } catch {
          // intentionally swallowed — health check will report db:'down'
        }
        return ds;
      },
    },
  ],
  exports: [DATA_SOURCE],
})
export class DatabaseModule {}
