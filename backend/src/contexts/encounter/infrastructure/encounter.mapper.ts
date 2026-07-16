import {
  EncounterId,
  PatientId,
  TemplateId,
  UserId,
} from '../../../shared-kernel';
import { Encounter } from '../domain/encounter.aggregate';
import { EncounterStatus } from '../domain/value-objects/encounter-status';
import { Transcript } from '../domain/value-objects/transcript';
import { SoapNote } from '../domain/value-objects/soap-note';
import { Assessment } from '../domain/value-objects/assessment';
import { Icd10Suggestion } from '../domain/value-objects/icd10-suggestion';
import { EncounterOrmEntity, type SoapNoteJson } from './encounter.orm-entity';

export class EncounterMapper {
  static toDomain(orm: EncounterOrmEntity): Encounter {
    const transcript = orm.currentTranscript
      ? Transcript.create(orm.currentTranscript)
      : null;

    const workingDraft = orm.workingDraftJson
      ? EncounterMapper.jsonToSoapNote(orm.workingDraftJson)
      : null;

    const selectedTemplateRef = orm.selectedTemplateId
      ? new TemplateId(orm.selectedTemplateId)
      : null;

    return Encounter.fromPersistence(new EncounterId(orm.id), {
      patientRef: new PatientId(orm.patientId),
      providerRef: new UserId(orm.providerId),
      status: orm.status as EncounterStatus,
      transcript,
      selectedTemplateRef,
      workingDraft,
      createdAt: orm.createdAt,
    });
  }

  static toOrm(encounter: Encounter): Partial<EncounterOrmEntity> {
    return {
      id: encounter.id.value,
      patientId: encounter.patientRef.value,
      providerId: encounter.providerRef.value,
      status: encounter.status,
      currentTranscript: encounter.transcript?.text ?? null,
      workingDraftJson: encounter.workingDraft
        ? EncounterMapper.soapNoteToJson(encounter.workingDraft)
        : null,
      selectedTemplateId: encounter.selectedTemplateRef?.value ?? null,
    };
  }

  private static jsonToSoapNote(json: SoapNoteJson): SoapNote {
    const icd10 = json.assessment.icd10.map((c) =>
      Icd10Suggestion.create(c.code, c.description),
    );
    const assessment = Assessment.create(json.assessment.text, icd10);
    return SoapNote.create(
      json.subjective,
      json.objective,
      assessment,
      json.plan,
    );
  }

  private static soapNoteToJson(note: SoapNote): SoapNoteJson {
    return {
      subjective: note.subjective,
      objective: note.objective,
      assessment: {
        text: note.assessment.text,
        icd10: note.assessment.icd10.map((c) => ({
          code: c.code,
          description: c.description,
        })),
      },
      plan: note.plan,
    };
  }
}
