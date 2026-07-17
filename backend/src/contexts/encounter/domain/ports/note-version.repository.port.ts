import type { NoteVersion } from '../note-version.aggregate';

export interface NoteVersionRepositoryPort {
  /** Atomically selects the next version number and appends in one DB transaction. */
  appendAtomic(version: NoteVersion): Promise<NoteVersion>;
  listByEncounter(encounterId: string): Promise<NoteVersion[]>;
  findByEncounterAndVersion(encounterId: string, versionNo: number): Promise<NoteVersion | null>;
  findByDraftRevision(encounterId: string, draftRevision: string): Promise<NoteVersion | null>;
}

export const NOTE_VERSION_REPOSITORY = 'NOTE_VERSION_REPOSITORY';
