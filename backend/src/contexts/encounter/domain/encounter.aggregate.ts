import {
  AggregateRoot,
  DomainException,
  EncounterId,
  PatientId,
  TemplateId,
  UserId,
} from '../../../shared-kernel';
import { EncounterStarted } from './events/encounter-started.event';
import { DraftUpdated } from './events/draft-updated.event';
import { EncounterFinalized } from './events/encounter-finalized.event';
import { EncounterStatus } from './value-objects/encounter-status';
import { SoapNote } from './value-objects/soap-note';
import { Transcript } from './value-objects/transcript';

interface EncounterProps {
  patientRef: PatientId;
  providerRef: UserId;
  status: EncounterStatus;
  transcript: Transcript | null;
  selectedTemplateRef: TemplateId | null;
  workingDraft: SoapNote | null;
  createdAt: Date;
}

export class Encounter extends AggregateRoot<EncounterId> {
  private _props: EncounterProps;

  private constructor(id: EncounterId, props: EncounterProps) {
    super(id);
    this._props = props;
  }

  get patientRef(): PatientId {
    return this._props.patientRef;
  }

  get providerRef(): UserId {
    return this._props.providerRef;
  }

  get status(): EncounterStatus {
    return this._props.status;
  }

  get transcript(): Transcript | null {
    return this._props.transcript;
  }

  get selectedTemplateRef(): TemplateId | null {
    return this._props.selectedTemplateRef;
  }

  get workingDraft(): SoapNote | null {
    return this._props.workingDraft;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  static start(
    id: EncounterId,
    patientRef: PatientId,
    providerRef: UserId,
    now: Date,
    selectedTemplateRef?: TemplateId,
  ): Encounter {
    const encounter = new Encounter(id, {
      patientRef,
      providerRef,
      status: EncounterStatus.DRAFT,
      transcript: null,
      selectedTemplateRef: selectedTemplateRef ?? null,
      workingDraft: null,
      createdAt: now,
    });
    encounter.record(
      new EncounterStarted(
        id.value,
        providerRef.value,
        patientRef.value,
      ),
    );
    return encounter;
  }

  static fromPersistence(
    id: EncounterId,
    props: EncounterProps,
  ): Encounter {
    return new Encounter(id, props);
  }

  setTranscript(transcript: Transcript): void {
    this.assertDraft('set transcript');
    this._props = { ...this._props, transcript };
  }

  updateDraft(draft: SoapNote): void {
    this.assertDraft('update draft');
    this._props = { ...this._props, workingDraft: draft };
    this.record(new DraftUpdated(this.id.value));
  }

  selectTemplate(ref: TemplateId): void {
    this.assertDraft('select template');
    this._props = { ...this._props, selectedTemplateRef: ref };
  }

  finalize(): void {
    this.assertDraft('finalize');
    this._props = { ...this._props, status: EncounterStatus.FINALIZED };
    this.record(
      new EncounterFinalized(this.id.value, this._props.providerRef.value),
    );
  }

  private assertDraft(action: string): void {
    if (this._props.status !== EncounterStatus.DRAFT) {
      throw new DomainException(
        `Cannot ${action} on a finalized encounter`,
        'ENCOUNTER_ALREADY_FINALIZED',
        409,
      );
    }
  }
}
