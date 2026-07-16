import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EncounterStatus } from '../domain/value-objects/encounter-status';

export interface SoapNoteJson {
  subjective: string;
  objective: string;
  assessment: {
    text: string;
    icd10: Array<{ code: string; description: string }>;
  };
  plan: string;
}

@Entity('encounters')
export class EncounterOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @Column({ type: 'enum', enum: EncounterStatus, default: EncounterStatus.DRAFT })
  status: EncounterStatus;

  @Column({ name: 'current_transcript', nullable: true, type: 'text' })
  currentTranscript: string | null;

  @Column({ name: 'working_draft_json', nullable: true, type: 'jsonb' })
  workingDraftJson: SoapNoteJson | null;

  @Column({ name: 'selected_template_id', nullable: true, type: 'uuid' })
  selectedTemplateId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
