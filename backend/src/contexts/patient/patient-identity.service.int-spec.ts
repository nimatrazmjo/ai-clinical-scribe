import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TestDb } from '../../../test/support/test-db';
import { PatientEntity } from './patient.entity';
import { PatientIdentityService } from './patient-identity.service';
import { DATA_SOURCE } from '../../database/database.module';
import { ALL_ENTITIES, ALL_MIGRATIONS } from '../../database/database.module';
import { CLOCK } from '../../shared-kernel/tokens';
import { SystemClock } from '../../shared-kernel/implementations/system-clock';

describe('PatientIdentityService (integration)', () => {
  let testDb: TestDb;
  let ds: DataSource;
  let svc: PatientIdentityService;

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: DATA_SOURCE, useValue: ds },
        { provide: CLOCK, useClass: SystemClock },
        PatientIdentityService,
      ],
    }).compile();

    svc = moduleRef.get(PatientIdentityService);
  }, 120_000);

  afterAll(async () => {
    await ds.destroy();
    await testDb.stop();
  }, 30_000);

  beforeEach(async () => {
    // encounters FK references patients — truncate dependents first
    await ds.query('TRUNCATE TABLE encounters, patients RESTART IDENTITY CASCADE');
  });

  const dto = {
    firstName: 'Alice',
    lastName: 'Smith',
    dateOfBirth: '1990-06-15',
  };

  it('creates a patient on first call (E-09)', async () => {
    const p = await svc.resolveOrCreate(dto);
    expect(p.id).toBeTruthy();
    expect(p.firstName).toBe('Alice');
  });

  it('resolves to the same patient on second call with identical input (E-09)', async () => {
    const p1 = await svc.resolveOrCreate(dto);
    const p2 = await svc.resolveOrCreate(dto);
    expect(p1.id).toBe(p2.id);
    const count = await ds.getRepository(PatientEntity).count();
    expect(count).toBe(1);
  });

  it('resolves to the same patient when casing/accents differ (E-10)', async () => {
    const p1 = await svc.resolveOrCreate(dto);
    const p2 = await svc.resolveOrCreate({
      firstName: 'ALICE',
      lastName: 'smith',
      dateOfBirth: '1990-06-15',
    });
    expect(p1.id).toBe(p2.id);
  });

  it('creates distinct patients when DOB differs (E-12)', async () => {
    const p1 = await svc.resolveOrCreate(dto);
    const p2 = await svc.resolveOrCreate({
      ...dto,
      dateOfBirth: '1991-06-15',
    });
    expect(p1.id).not.toBe(p2.id);
    const count = await ds.getRepository(PatientEntity).count();
    expect(count).toBe(2);
  });
});
