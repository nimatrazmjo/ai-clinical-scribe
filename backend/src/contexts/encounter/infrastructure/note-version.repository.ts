import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EncounterId, NoteVersionId, UserId } from '../../../shared-kernel';
import { NoteVersion } from '../domain/note-version.aggregate';
import type { NoteVersionRepositoryPort } from '../domain/ports/note-version.repository.port';
import { NoteVersionOrmEntity } from './note-version.orm-entity';

@Injectable()
export class NoteVersionRepository implements NoteVersionRepositoryPort {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async appendAtomic(version: NoteVersion): Promise<NoteVersion> {
    return this.ds.transaction(async (manager) => {
      // Serialize concurrent saves for the same encounter by locking the parent
      // encounter row (FOR UPDATE is not allowed alongside an aggregate, so it
      // can't sit on the MAX query itself). Two writers then compute version_no
      // one after the other; the uq_note_versions_encounter_version constraint
      // is the final backstop.
      await manager.query(`SELECT 1 FROM encounters WHERE id = $1 FOR UPDATE`, [
        version.encounterId.value,
      ]);
      const result = await manager.query<Array<{ max: string | null }>>(
        `SELECT MAX(version_no) AS max FROM note_versions WHERE encounter_id = $1`,
        [version.encounterId.value],
      );
      const max = result[0]?.max;
      const versionNo = max == null ? 1 : Number(max) + 1;

      const contentJson = {
        subjective: version.content.subjective,
        objective: version.content.objective,
        assessment: {
          text: version.content.assessment.text,
          icd10: version.content.assessment.icd10.map((c) => ({
            code: c.code,
            description: c.description,
          })),
        },
        plan: version.content.plan,
      };
      const saved = await manager.getRepository(NoteVersionOrmEntity).save({
        id: version.id.value,
        encounterId: version.encounterId.value,
        versionNo,
        contentJson,
        savedBy: version.savedBy.value,
        savedAt: version.savedAt,
        draftRevision: version.draftRevision ?? null,
      });
      return this.toDomain(saved);
    });
  }

  async findByDraftRevision(
    encounterId: string,
    draftRevision: string,
  ): Promise<NoteVersion | null> {
    const orm = await this.ds
      .getRepository(NoteVersionOrmEntity)
      .findOneBy({ encounterId, draftRevision });
    return orm ? this.toDomain(orm) : null;
  }

  async listByEncounter(encounterId: string): Promise<NoteVersion[]> {
    const rows = await this.ds.getRepository(NoteVersionOrmEntity).find({
      where: { encounterId },
      order: { versionNo: 'ASC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findByEncounterAndVersion(
    encounterId: string,
    versionNo: number,
  ): Promise<NoteVersion | null> {
    const orm = await this.ds
      .getRepository(NoteVersionOrmEntity)
      .findOneBy({ encounterId, versionNo });
    return orm ? this.toDomain(orm) : null;
  }

  private toDomain(orm: NoteVersionOrmEntity): NoteVersion {
    const content = NoteVersion.jsonToSoapNote(orm.contentJson);
    return NoteVersion.fromPersistence(new NoteVersionId(orm.id), {
      encounterId: new EncounterId(orm.encounterId),
      versionNo: orm.versionNo,
      content,
      savedBy: new UserId(orm.savedBy),
      savedAt: orm.savedAt,
    });
  }
}
