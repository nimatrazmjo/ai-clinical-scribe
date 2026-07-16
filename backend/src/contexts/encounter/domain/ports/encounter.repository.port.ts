import { Encounter } from '../encounter.aggregate';
import { EncounterId } from '../../../../shared-kernel';

export interface EncounterRepositoryPort {
  findById(id: EncounterId): Promise<Encounter | null>;
  findByProvider(providerRef: string): Promise<Encounter[]>;
  save(encounter: Encounter): Promise<Encounter>;
}

export const ENCOUNTER_REPOSITORY = 'ENCOUNTER_REPOSITORY';
