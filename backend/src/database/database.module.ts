import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserEntity } from '../contexts/identity/user.entity';
import { PatientEntity } from '../contexts/patient/patient.entity';
import { EncounterOrmEntity } from '../contexts/encounter/infrastructure/encounter.orm-entity';
import { NoteVersionOrmEntity } from '../contexts/encounter/infrastructure/note-version.orm-entity';
import { AuditEntryOrmEntity } from '../contexts/audit/audit-entry.orm-entity';
import { SecretsModule } from '../secrets/secrets.module';
import {
  SECRETS_PROVIDER,
  SecretsProvider,
} from '../secrets/secrets-provider.port';
import { EnablePgcrypto1000000000000 } from './migrations/1000000000000-EnablePgcrypto';
import { CreateUsers1000000000001 } from './migrations/1000000000001-CreateUsers';
import { CreatePatients1000000000002 } from './migrations/1000000000002-CreatePatients';
import { CreateEncounters1000000000003 } from './migrations/1000000000003-CreateEncounters';
import { CreateNoteVersions1000000000004 } from './migrations/1000000000004-CreateNoteVersions';
import { AddDraftRevision1000000000005 } from './migrations/1000000000005-AddDraftRevision';
import { CreateAuditLog1000000000006 } from './migrations/1000000000006-CreateAuditLog';
import { CreateIcd10Codes1000000000007 } from './migrations/1000000000007-CreateIcd10Codes';

export const DATA_SOURCE = 'DATA_SOURCE';

export const ALL_ENTITIES = [UserEntity, PatientEntity, EncounterOrmEntity, NoteVersionOrmEntity, AuditEntryOrmEntity];
export const ALL_MIGRATIONS = [
  EnablePgcrypto1000000000000,
  CreateUsers1000000000001,
  CreatePatients1000000000002,
  CreateEncounters1000000000003,
  CreateNoteVersions1000000000004,
  AddDraftRevision1000000000005,
  CreateAuditLog1000000000006,
  CreateIcd10Codes1000000000007,
];

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
          entities: ALL_ENTITIES,
          migrationsTableName: 'migrations',
          migrations: ALL_MIGRATIONS,
        });
        // Connection failures are surfaced via the health endpoint (db:'down'),
        // not by crashing the app at boot. Missing DATABASE_URL does fail fast (E-41).
        try {
          await ds.initialize();
          await ds.runMigrations();
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
