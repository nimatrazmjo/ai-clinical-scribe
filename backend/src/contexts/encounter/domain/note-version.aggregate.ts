import { AggregateRoot, EncounterId, NoteVersionId, UserId } from '../../../shared-kernel';
import { SoapNote } from './value-objects/soap-note';
import { Assessment } from './value-objects/assessment';
import { Icd10Suggestion } from './value-objects/icd10-suggestion';
import type { SoapNoteJson } from '../infrastructure/encounter.orm-entity';

interface NoteVersionProps {
  encounterId: EncounterId;
  versionNo: number;
  content: SoapNote;
  savedBy: UserId;
  savedAt: Date;
  draftRevision?: string | null;
}

export class NoteVersion extends AggregateRoot<NoteVersionId> {
  private _props: NoteVersionProps;

  private constructor(id: NoteVersionId, props: NoteVersionProps) {
    super(id);
    this._props = props;
  }

  get encounterId(): EncounterId {
    return this._props.encounterId;
  }

  get versionNo(): number {
    return this._props.versionNo;
  }

  get content(): SoapNote {
    return this._props.content;
  }

  get savedBy(): UserId {
    return this._props.savedBy;
  }

  get savedAt(): Date {
    return this._props.savedAt;
  }

  get draftRevision(): string | null | undefined {
    return this._props.draftRevision;
  }

  static create(
    id: NoteVersionId,
    encounterId: EncounterId,
    versionNo: number,
    content: SoapNote,
    savedBy: UserId,
    savedAt: Date,
    draftRevision?: string | null,
  ): NoteVersion {
    return new NoteVersion(id, { encounterId, versionNo, content, savedBy, savedAt, draftRevision });
  }

  static fromPersistence(
    id: NoteVersionId,
    props: NoteVersionProps,
  ): NoteVersion {
    return new NoteVersion(id, props);
  }

  static jsonToSoapNote(json: SoapNoteJson): SoapNote {
    const icd10 = json.assessment.icd10.map((c) =>
      Icd10Suggestion.create(c.code, c.description),
    );
    const assessment = Assessment.create(json.assessment.text, icd10);
    return SoapNote.create(json.subjective, json.objective, assessment, json.plan);
  }
}
