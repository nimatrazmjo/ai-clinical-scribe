import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { TestDb } from '../../../../test/support/test-db';
import { ALL_ENTITIES, ALL_MIGRATIONS } from '../../../database/database.module';
import { EncounterRepository } from './encounter.repository';
import { Encounter } from '../domain/encounter.aggregate';
import { EncounterId, PatientId, UserId } from '../../../shared-kernel';
import { Transcript } from '../domain/value-objects/transcript';
import { SoapNote } from '../domain/value-objects/soap-note';
import { Assessment } from '../domain/value-objects/assessment';
import { Icd10Suggestion } from '../domain/value-objects/icd10-suggestion';
import { EncounterStatus } from '../domain/value-objects/encounter-status';
import { UserEntity, UserRole } from '../../identity/user.entity';
import { PatientEntity } from '../../patient/patient.entity';

const NOW = new Date('2026-07-16T12:00:00Z');

function makeEncounter(providerId: string, patientId: string) {
  return Encounter.start(
    new EncounterId(randomUUID()),
    new PatientId(patientId),
    new UserId(providerId),
    NOW,
  );
}

function makeSoap(): SoapNote {
  const icd = Icd10Suggestion.create('I10', 'Essential hypertension');
  const assessment = Assessment.create('Hypertension noted', [icd]);
  return SoapNote.create(
    'Patient c/o headache',
    'BP 140/90',
    assessment,
    'Start lisinopril 10mg daily',
  );
}

describe('EncounterRepository (integration)', () => {
  let testDb: TestDb;
  let ds: DataSource;
  let repo: EncounterRepository;
  let providerId: string;
  let patientId: string;

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

    repo = new EncounterRepository(ds as never);

    // seed a user and patient for FK constraints
    const savedUser = await ds.getRepository(UserEntity).save({
      email: 'provider@int.clinic',
      firstName: 'Doc',
      lastName: 'Test',
      role: UserRole.PROVIDER,
      passwordHash: 'hash',
      isActive: true,
    });
    providerId = savedUser.id;

    const savedPatient = await ds.getRepository(PatientEntity).save({
      firstName: 'Alice',
      lastName: 'Smith',
      dateOfBirth: '1990-01-01',
      matchKey: 'alice|smith|1990-01-01',
    });
    patientId = savedPatient.id;
  }, 120_000);

  afterAll(async () => {
    await ds.destroy();
    await testDb.stop();
  }, 30_000);

  it('saves an encounter and reloads it with correct fields', async () => {
    const enc = makeEncounter(providerId, patientId);
    enc.pullEvents();
    enc.setTranscript(Transcript.create('Patient reports pain'));

    const saved = await repo.save(enc);
    const loaded = await repo.findById(new EncounterId(saved.id.value));

    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe(EncounterStatus.DRAFT);
    expect(loaded!.transcript?.text).toBe('Patient reports pain');
    expect(loaded!.providerRef.value).toBe(providerId);
    expect(loaded!.patientRef.value).toBe(patientId);
  });

  it('persists and rehydrates workingDraftJson losslessly', async () => {
    const enc = makeEncounter(providerId, patientId);
    enc.pullEvents();
    enc.updateDraft(makeSoap());
    enc.pullEvents();

    const saved = await repo.save(enc);
    const loaded = await repo.findById(new EncounterId(saved.id.value));

    const draft = loaded!.workingDraft;
    expect(draft).not.toBeNull();
    expect(draft!.subjective).toBe('Patient c/o headache');
    expect(draft!.assessment.icd10[0].code).toBe('I10');
    expect(draft!.plan).toBe('Start lisinopril 10mg daily');
  });

  it('findByProvider returns only that provider\'s encounters (E-07)', async () => {
    // save a second provider with their own encounter
    const otherUser = await ds.getRepository(UserEntity).save({
      email: 'other@int.clinic',
      firstName: 'Other',
      lastName: 'Doc',
      role: UserRole.PROVIDER,
      passwordHash: 'hash',
      isActive: true,
    });

    const enc = makeEncounter(otherUser.id, patientId);
    await repo.save(enc);

    const mine = await repo.findByProvider(providerId);
    const theirs = await repo.findByProvider(otherUser.id);

    expect(mine.every((e) => e.providerRef.value === providerId)).toBe(true);
    expect(theirs.every((e) => e.providerRef.value === otherUser.id)).toBe(
      true,
    );
  });

  it('returns null for an unknown encounter id', async () => {
    const result = await repo.findById(new EncounterId('00000000-0000-0000-0000-000000000000'));
    expect(result).toBeNull();
  });
});
