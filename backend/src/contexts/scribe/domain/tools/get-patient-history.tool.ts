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

@Injectable()
export class GetPatientHistoryTool implements GenerationTool {
  readonly name = 'get_patient_history';
  readonly description =
    'Retrieves the five most recent finalized SOAP notes for a patient, ordered newest first.';
  readonly schema = {
    type: 'object',
    properties: {
      patientId: { type: 'string', description: 'UUID of the patient' },
    },
    required: ['patientId'],
  };

  constructor(@Inject(DATA_SOURCE) private readonly ds: DataSource) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const patientId = args['patientId'] as string;
    const rows = await this.ds.query<HistoryRow[]>(
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
  }
}
