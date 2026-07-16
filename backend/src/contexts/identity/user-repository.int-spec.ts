import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TestDb } from '../../../test/support/test-db';
import { ALL_ENTITIES, ALL_MIGRATIONS } from '../../database/database.module';
import { seedUsers } from './seed/seed-fn';
import { UserEntity, UserRole } from './user.entity';
import { UserRepository } from './user.repository';

describe('UserRepository (integration)', () => {
  let testDb: TestDb;
  let ds: DataSource;
  let repo: UserRepository;

  beforeAll(async () => {
    testDb = await TestDb.start();
    ds = new DataSource({
      type: 'postgres',
      url: testDb.connectionUri,
      synchronize: false,
      entities: ALL_ENTITIES,
      migrations: ALL_MIGRATIONS,
      migrationsTableName: 'migrations',
    });
    await ds.initialize();
    await ds.runMigrations();
    repo = new UserRepository(ds);
  }, 60000);

  afterAll(async () => {
    await ds.destroy();
    await testDb.stop();
  }, 30000);

  function makeUser(
    email: string,
    overrides: Partial<UserEntity> = {},
  ): UserEntity {
    const u = new UserEntity();
    u.email = email;
    u.firstName = 'Test';
    u.lastName = 'User';
    u.role = UserRole.PROVIDER;
    u.passwordHash = 'hashed-password';
    u.isActive = true;
    return Object.assign(u, overrides);
  }

  it('saves a user and retrieves it by email', async () => {
    const saved = await repo.save(makeUser('alice@test.example'));
    const found = await repo.findByEmail('alice@test.example');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
    expect(found!.email).toBe('alice@test.example');
    expect(found!.firstName).toBe('Test');
    expect(found!.isActive).toBe(true);
  });

  it('retrieves a user by id', async () => {
    const saved = await repo.save(makeUser('bob@test.example'));
    const found = await repo.findById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
  });

  it('returns null for non-existent email', async () => {
    const result = await repo.findByEmail('nobody@test.example');
    expect(result).toBeNull();
  });

  it('throws ConflictException on duplicate email', async () => {
    await repo.save(makeUser('carol@test.example'));
    await expect(
      repo.save(makeUser('carol@test.example')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('persists and retrieves isActive=false user (feeds E-02)', async () => {
    const saved = await repo.save(
      makeUser('inactive@test.example', { isActive: false }),
    );
    const found = await repo.findById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.isActive).toBe(false);
  });

  describe('seed idempotency', () => {
    it('running seed twice produces exactly 4 rows', async () => {
      await seedUsers(ds);
      await seedUsers(ds);
      const rows = await ds.query(
        `SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@demo.clinic'`,
      );
      expect(parseInt(rows[0].n as string, 10)).toBe(4);
    });
  });
});
