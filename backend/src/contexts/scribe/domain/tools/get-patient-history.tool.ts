import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../../database/database.module';
import type { GenerationTool } from '../ports/generation-tool.port';
import type { SoapNoteJson } from '../../../encounter/infrastructure/encounter.orm-entity';

interface HistoryRow {
  encounter_id: string;
  version_no: number;
  saved_at: Date;
  content_json: SoapNoteJson;
}

/**
 * Factory for the history tool. The patient is fixed server-side from the
 * encounter under generation — the model never sees or supplies the patient
 * UUID (it isn't in the prompt), so the exposed tool takes no arguments and
 * the model simply invokes it to pull prior notes.
 */
@Injectable()
export class GetPatientHistoryTool {
  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  forPatient(patientId: string): GenerationTool {
    const ds = this.ds;
    return {
      name: 'get_patient_history',
      description:
        "Retrieves the five most recent finalized SOAP notes for this encounter's patient, ordered newest first. Takes no arguments.",
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      async execute(): Promise<unknown> {
        const rows = await ds.query<HistoryRow[]>(
          `SELECT
             nv.encounter_id,
             nv.version_no,
             nv.saved_at,
             nv.content_json
           FROM note_versions nv
           JOIN encounters e ON e.id = nv.encounter_id
           WHERE e.patient_id = $1
           ORDER BY nv.saved_at DESC
           LIMIT 5`,
          [patientId],
        );
        return rows.map((r) => ({
          encounterId: r.encounter_id,
          versionNo: r.version_no,
          savedAt: r.saved_at,
          note: r.content_json,
        }));
      },
    };
  }
}
