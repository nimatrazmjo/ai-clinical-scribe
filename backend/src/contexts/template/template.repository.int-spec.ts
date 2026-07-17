import { DataSource } from 'typeorm';
import { TestDb } from '../../../test/support/test-db';
import { ALL_ENTITIES, ALL_MIGRATIONS } from '../../database/database.module';
import { TemplateRepository } from './template.repository';
import { UserEntity, UserRole } from '../identity/user.entity';

describe('TemplateRepository (integration)', () => {
  let testDb: TestDb;
  let ds: DataSource;
  let repo: TemplateRepository;
  let creatorId: string;

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
    repo = new TemplateRepository(ds as never);

    const user = await ds.getRepository(UserEntity).save({
      email: 'tmpl-admin@int.test',
      firstName: 'Admin',
      lastName: 'Test',
      role: UserRole.ADMIN,
      passwordHash: 'hash',
      isActive: true,
    });
    creatorId = user.id;
  }, 120_000);

  afterAll(async () => {
    await ds.destroy();
    await testDb.stop();
  }, 30_000);

  beforeEach(async () => {
    await ds.query('DELETE FROM templates');
  });

  it('saves and finds a template by id', async () => {
    const saved = await repo.save({
      name: 'SOAP General',
      encounterType: 'general',
      promptBody: 'Generate a SOAP note.',
      isActive: false,
      createdBy: creatorId,
    });

    const found = await repo.findById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('SOAP General');
    expect(found!.promptBody).toBe('Generate a SOAP note.');
  });

  it('findAll returns all templates', async () => {
    await repo.save({ name: 'T1', promptBody: 'body1', isActive: false, createdBy: creatorId });
    await repo.save({ name: 'T2', promptBody: 'body2', isActive: true, createdBy: creatorId });

    const all = await repo.findAll();
    expect(all.length).toBe(2);
  });

  it('findActive returns active template, null when none active (E-34)', async () => {
    const noActive = await repo.findActive();
    expect(noActive).toBeNull();

    await repo.save({ name: 'Active', promptBody: 'active body', isActive: true, createdBy: creatorId });
    const active = await repo.findActive();
    expect(active).not.toBeNull();
    expect(active!.promptBody).toBe('active body');
  });

  it('softDelete sets isActive=false; findActive returns null (E-34)', async () => {
    const tmpl = await repo.save({ name: 'ToDelete', promptBody: 'body', isActive: true, createdBy: creatorId });
    expect(await repo.findActive()).not.toBeNull();

    await repo.softDelete(tmpl.id);

    const deleted = await repo.findById(tmpl.id);
    expect(deleted!.isActive).toBe(false);
    expect(await repo.findActive()).toBeNull();
  });
});
