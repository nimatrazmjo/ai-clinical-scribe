import { EncounterId, PatientId, UserId } from '../../../shared-kernel';
import { Encounter } from './encounter.aggregate';
import { EncounterStatus } from './value-objects/encounter-status';
import { Transcript } from './value-objects/transcript';
import { SoapNote } from './value-objects/soap-note';
import { Assessment } from './value-objects/assessment';
import { Icd10Suggestion } from './value-objects/icd10-suggestion';
import { EncounterStarted } from './events/encounter-started.event';
import { DraftUpdated } from './events/draft-updated.event';
import { EncounterFinalized } from './events/encounter-finalized.event';

const enc = () =>
  Encounter.start(
    new EncounterId('e-1'),
    new PatientId('p-1'),
    new UserId('u-1'),
    new Date('2026-07-16T12:00:00Z'),
  );

const icd = () => Icd10Suggestion.create('I10', 'Essential hypertension');
const assessment = () => Assessment.create('Hypertension', [icd()]);
const soap = () =>
  SoapNote.create(
    'Patient reports headache',
    'BP 140/90',
    assessment(),
    'Start lisinopril 10mg daily',
  );

describe('Transcript VO', () => {
  it('creates with valid text', () => {
    const t = Transcript.create('patient says hello');
    expect(t.text).toBe('patient says hello');
  });

  it('rejects empty text (E-17)', () => {
    expect(() => Transcript.create('')).toThrow();
    expect(() => Transcript.create('   ')).toThrow();
  });

  it('rejects oversized text (E-14)', () => {
    const big = 'x'.repeat(Transcript.MAX_CHARS + 1);
    expect(() => Transcript.create(big)).toThrow();
  });

  it('accepts text exactly at the limit', () => {
    const edge = 'x'.repeat(Transcript.MAX_CHARS);
    expect(() => Transcript.create(edge)).not.toThrow();
  });
});

describe('Icd10Suggestion VO', () => {
  it('creates with valid code and description', () => {
    const s = Icd10Suggestion.create('I10', 'Essential hypertension');
    expect(s.code).toBe('I10');
  });

  it('uppercases the code', () => {
    expect(Icd10Suggestion.create('i10', 'desc').code).toBe('I10');
  });

  it('rejects blank code', () => {
    expect(() => Icd10Suggestion.create('', 'desc')).toThrow();
  });

  it('rejects blank description', () => {
    expect(() => Icd10Suggestion.create('I10', '')).toThrow();
  });
});

describe('Assessment VO', () => {
  it('creates with at least one ICD-10 code', () => {
    const a = assessment();
    expect(a.icd10).toHaveLength(1);
  });

  it('rejects empty ICD-10 list (E-22)', () => {
    expect(() => Assessment.create('text', [])).toThrow();
  });
});

describe('SoapNote VO', () => {
  it('creates with all four sections', () => {
    const note = soap();
    expect(note.subjective).toBeTruthy();
    expect(note.objective).toBeTruthy();
    expect(note.assessment).toBeDefined();
    expect(note.plan).toBeTruthy();
  });

  it('rejects blank subjective', () => {
    expect(() =>
      SoapNote.create('', 'obj', assessment(), 'plan'),
    ).toThrow();
  });

  it('rejects blank objective', () => {
    expect(() =>
      SoapNote.create('subj', '', assessment(), 'plan'),
    ).toThrow();
  });

  it('rejects blank plan', () => {
    expect(() =>
      SoapNote.create('subj', 'obj', assessment(), ''),
    ).toThrow();
  });
});

describe('Encounter aggregate — start', () => {
  it('starts in DRAFT status', () => {
    expect(enc().status).toBe(EncounterStatus.DRAFT);
  });

  it('records an EncounterStarted event', () => {
    const e = enc();
    const events = e.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(EncounterStarted);
  });

  it('pullEvents clears the event list', () => {
    const e = enc();
    e.pullEvents();
    expect(e.pullEvents()).toHaveLength(0);
  });

  it('workingDraft is null initially', () => {
    expect(enc().workingDraft).toBeNull();
  });
});

describe('Encounter aggregate — updateDraft', () => {
  it('stores the draft and records DraftUpdated', () => {
    const e = enc();
    e.pullEvents();
    e.updateDraft(soap());
    expect(e.workingDraft).not.toBeNull();
    const events = e.pullEvents();
    expect(events[0]).toBeInstanceOf(DraftUpdated);
  });

  it('rejects draft update on a finalized encounter (E-16)', () => {
    const e = enc();
    e.pullEvents();
    e.finalize();
    expect(() => e.updateDraft(soap())).toThrow();
  });
});

describe('Encounter aggregate — finalize', () => {
  it('transitions status to FINALIZED and records EncounterFinalized', () => {
    const e = enc();
    e.pullEvents();
    e.finalize();
    expect(e.status).toBe(EncounterStatus.FINALIZED);
    const events = e.pullEvents();
    expect(events[0]).toBeInstanceOf(EncounterFinalized);
  });

  it('throws if already finalized (E-16)', () => {
    const e = enc();
    e.pullEvents();
    e.finalize();
    expect(() => e.finalize()).toThrow();
  });
});

describe('Encounter aggregate — setTranscript', () => {
  it('stores the transcript', () => {
    const e = enc();
    e.setTranscript(Transcript.create('some text'));
    expect(e.transcript?.text).toBe('some text');
  });

  it('rejects transcript update on a finalized encounter', () => {
    const e = enc();
    e.finalize();
    expect(() => e.setTranscript(Transcript.create('text'))).toThrow();
  });
});

describe('Encounter aggregate — fromPersistence', () => {
  it('reconstructs without recording events', () => {
    const e = Encounter.fromPersistence(new EncounterId('e-2'), {
      patientRef: new PatientId('p-1'),
      providerRef: new UserId('u-1'),
      status: EncounterStatus.FINALIZED,
      transcript: Transcript.create('hello'),
      selectedTemplateRef: null,
      workingDraft: soap(),
      createdAt: new Date(),
    });
    expect(e.status).toBe(EncounterStatus.FINALIZED);
    expect(e.pullEvents()).toHaveLength(0);
  });
});
