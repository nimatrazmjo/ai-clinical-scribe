import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { SoapNoteJson } from './encounter.orm-entity';

@Entity('note_versions')
@Unique(['encounterId', 'versionNo'])
export class NoteVersionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'encounter_id', type: 'uuid' })
  encounterId: string;

  @Column({ name: 'version_no', type: 'integer' })
  versionNo: number;

  @Column({ name: 'content_json', type: 'jsonb' })
  contentJson: SoapNoteJson;

  @Column({ name: 'saved_by', type: 'uuid' })
  savedBy: string;

  @CreateDateColumn({ name: 'saved_at' })
  savedAt: Date;
}
