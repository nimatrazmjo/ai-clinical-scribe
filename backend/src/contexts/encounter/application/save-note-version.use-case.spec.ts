import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SaveNoteVersionUseCase } from './save-note-version.use-case';
import { FixedClock, SeqIdGenerator } from '../../../shared-kernel';
import { Encounter } from '../domain/encounter.aggregate';
import { EncounterId, PatientId, UserId, NoteVersionId } from '../../../shared-kernel';
import { NoteVersion } from '../domain/note-version.aggregate';
import { Assessment } from '../domain/value-objects/assessment';
import { Icd10Suggestion } from '../domain/value-objects/icd10-suggestion';
import { SoapNote } from '../domain/value-objects/soap-note';
import type { SaveNoteDto } from './dto/save-note.dto';

const NOW = new Date('2026-07-16T12:00:00Z');
const PROVIDER_ID = randomUUID();
const PATIENT_ID = randomUUID();
const ENCOUNTER_ID = randomUUID();

function makeEncounter() {
  return Encounter.start(
    new EncounterId(ENCOUNTER_ID),
    new PatientId(PATIENT_ID),
    new UserId(PROVIDER_ID),
    NOW,
  );
}

function makeSoap(): SoapNote {
  const icd = Icd10Suggestion.create('I10', 'Essential hypertension');
  const assessment = Assessment.create('Hypertension noted', [icd]);
  return SoapNote.create('Patient c/o headache', 'BP 140/90', assessment, 'Lisinopril 10mg');
}

function makeNoteVersion(versionNo: number, draftRevision?: string): NoteVersion {
  return NoteVersion.create(
    new NoteVersionId(randomUUID()),
    new EncounterId(ENCOUNTER_ID),
    versionNo,
    makeSoap(),
    new UserId(PROVIDER_ID),
    NOW,
    draftRevision,
  );
}

const validDto: SaveNoteDto = {
  soapNote: {
    subjective: 'Patient c/o headache',
    objective: 'BP 140/90',
    assessment: { text: 'Hypertension noted', icd10: [{ code: 'I10', description: 'Essential hypertension' }] },
    plan: 'Lisinopril 10mg',
  },
};

describe('SaveNoteVersionUseCase', () => {
  let noteVersionRepo: {
    nextVersionNo: jest.Mock;
    append: jest.Mock;
    listByEncounter: jest.Mock;
    findByEncounterAndVersion: jest.Mock;
    findByDraftRevision: jest.Mock;
  };
  let encounterRepo: { save: jest.Mock; findByProviderAndId?: jest.Mock };
  let encounterRepository: { findByProviderAndId: jest.Mock; save: jest.Mock };
  let auditRepo: { record: jest.Mock };
  let useCase: SaveNoteVersionUseCase;

  beforeEach(() => {
    noteVersionRepo = {
      nextVersionNo: jest.fn().mockResolvedValue(1),
      append: jest.fn().mockImplementation((v: NoteVersion) =>
        Promise.resolve(makeNoteVersion(v.versionNo, v.draftRevision ?? undefined)),
      ),
      listByEncounter: jest.fn().mockResolvedValue([]),
      findByEncounterAndVersion: jest.fn().mockResolvedValue(null),
      findByDraftRevision: jest.fn().mockResolvedValue(null),
    };
    encounterRepository = {
      findByProviderAndId: jest.fn().mockResolvedValue(makeEncounter()),
      save: jest.fn().mockImplementation((e: Encounter) => Promise.resolve(e)),
    };
    encounterRepo = {
      save: jest.fn().mockImplementation((e: Encounter) => Promise.resolve(e)),
    };
    auditRepo = { record: jest.fn().mockResolvedValue(undefined) };

    useCase = new SaveNoteVersionUseCase(
      noteVersionRepo as never,
      encounterRepo as never,
      encounterRepository as never,
      new FixedClock(NOW),
      new SeqIdGenerator(),
      auditRepo as never,
    );
  });

  it('creates version 1 on first save (E-28)', async () => {
    const result = await useCase.execute(ENCOUNTER_ID, validDto, PROVIDER_ID);
    expect(result.versionNo).toBe(1);
    expect(noteVersionRepo.append).toHaveBeenCalledTimes(1);
    expect(encounterRepo.save).toHaveBeenCalledTimes(1);
  });

  it('creates version 2 on re-save with no draftRevision (E-31)', async () => {
    noteVersionRepo.nextVersionNo.mockResolvedValue(2);
    const result = await useCase.execute(ENCOUNTER_ID, validDto, PROVIDER_ID);
    expect(result.versionNo).toBe(2);
    expect(noteVersionRepo.append).toHaveBeenCalledTimes(1);
  });

  it('returns existing version idempotently when draftRevision already exists', async () => {
    const existing = makeNoteVersion(1, 'rev-abc');
    noteVersionRepo.findByDraftRevision.mockResolvedValue(existing);

    const dto = { ...validDto, draftRevision: 'rev-abc' };
    const result = await useCase.execute(ENCOUNTER_ID, dto, PROVIDER_ID);

    expect(result.versionNo).toBe(1);
    expect(result.draftRevision).toBe('rev-abc');
    expect(noteVersionRepo.append).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when encounter not found', async () => {
    encounterRepository.findByProviderAndId.mockResolvedValue(null);
    await expect(useCase.execute(ENCOUNTER_ID, validDto, PROVIDER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws DomainException 422 for invalid soap note structure', async () => {
    const badDto: SaveNoteDto = {
      soapNote: {
        subjective: '',
        objective: 'BP 140/90',
        assessment: { text: 'Hypertension', icd10: [{ code: 'I10', description: 'Hypertension' }] },
        plan: 'Rest',
      },
    };
    await expect(useCase.execute(ENCOUNTER_ID, badDto, PROVIDER_ID)).rejects.toMatchObject({
      code: 'INVALID_SOAP_NOTE',
      statusCode: 422,
    });
  });

  it('records a NOTE_SAVED audit entry on successful save (no PHI)', async () => {
    await useCase.execute(ENCOUNTER_ID, validDto, PROVIDER_ID);
    expect(auditRepo.record).toHaveBeenCalledTimes(1);
    const call = auditRepo.record.mock.calls[0][0] as Record<string, unknown>;
    expect(call.action).toBe('NOTE_SAVED');
    expect(call.entityType).toBe('encounter');
    expect(call.entityId).toBe(ENCOUNTER_ID);
    expect(call.actorId).toBe(PROVIDER_ID);
    // metadata must not contain any clinical text
    const meta = call.metadata as Record<string, unknown>;
    expect(typeof meta.versionNo).toBe('number');
    expect(JSON.stringify(meta)).not.toMatch(/patient|headache|bp|lisinopril/i);
  });

  it('does not record audit on idempotent replay (draftRevision already exists)', async () => {
    const existing = makeNoteVersion(1, 'rev-abc');
    noteVersionRepo.findByDraftRevision.mockResolvedValue(existing);

    await useCase.execute(ENCOUNTER_ID, { ...validDto, draftRevision: 'rev-abc' }, PROVIDER_ID);

    expect(auditRepo.record).not.toHaveBeenCalled();
  });
});
