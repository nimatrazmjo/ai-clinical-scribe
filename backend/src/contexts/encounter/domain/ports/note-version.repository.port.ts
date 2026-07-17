import type { NoteVersion } from '../note-version.aggregate';

export interface NoteVersionRepositoryPort {
  nextVersionNo(encounterId: string): Promise<number>;
  append(version: NoteVersion): Promise<NoteVersion>;
  listByEncounter(encounterId: string): Promise<NoteVersion[]>;
  findByEncounterAndVersion(encounterId: string, versionNo: number): Promise<NoteVersion | null>;
}

export const NOTE_VERSION_REPOSITORY = 'NOTE_VERSION_REPOSITORY';
