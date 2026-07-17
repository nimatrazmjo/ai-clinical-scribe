import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { TestDb } from '../../../test/support/test-db';
import { ALL_ENTITIES, ALL_MIGRATIONS } from '../../database/database.module';
import { AuditRepository } from './audit.repository';
import { AuditEntryOrmEntity } from './audit-entry.orm-entity';

describe('AuditRepository (integration)', () => {
  let testDb: TestDb;
  let ds: DataSource;
  let repo: AuditRepository;

  beforeAll(async () => {
    testDb = await TestDb.start();
    ds = new DataSource({
      type: 'postgres',
      url: testDb.connectionUri,
      synchronize: false,
      entities: ALL_ENTITIES,
      migrations: ALL_MIGRATIONS,
    });
    await ds.initialize();
    await ds.runMigrations();
    repo = new AuditRepository(ds as never);
  }, 120_000);

  afterAll(async () => {
    await ds.destroy();
    await testDb.stop();
  }, 30_000);

  it('persists an audit entry with all required fields', async () => {
    const actorId = randomUUID();
    const entityId = randomUUID();

    await repo.record({
      actorId,
      action: 'NOTE_SAVED',
      entityType: 'encounter',
      entityId,
      metadata: { versionNo: 1 },
    });

    const rows = await ds.getRepository(AuditEntryOrmEntity).find({
      where: { actorId, entityId },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('NOTE_SAVED');
    expect(rows[0].entityType).toBe('encounter');
    expect(rows[0].metadata).toEqual({ versionNo: 1 });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it('metadata contains no PHI — only numeric versionNo', async () => {
    const actorId = randomUUID();
    const entityId = randomUUID();

    await repo.record({
      actorId,
      action: 'NOTE_SAVED',
      entityType: 'encounter',
      entityId,
      metadata: { versionNo: 2 },
    });

    const [row] = await ds.getRepository(AuditEntryOrmEntity).find({
      where: { actorId, entityId },
    });

    const metaStr = JSON.stringify(row.metadata);
    expect(metaStr).not.toMatch(/patient|name|dob|diagnosis|subjective|plan/i);
    expect(row.metadata['versionNo']).toBe(2);
  });

  it('swallows DB errors without throwing (audit must never break main flow)', async () => {
    // destroy connection to force error
    const badDs = new DataSource({
      type: 'postgres',
      url: 'postgres://nobody:x@localhost:1/nonexistent',
      synchronize: false,
      entities: ALL_ENTITIES,
    });
    const badRepo = new AuditRepository(badDs as never);
    // should not throw
    await expect(
      badRepo.record({
        actorId: randomUUID(),
        action: 'NOTE_SAVED',
        entityType: 'encounter',
        entityId: randomUUID(),
        metadata: {},
      }),
    ).resolves.toBeUndefined();
  });
});
