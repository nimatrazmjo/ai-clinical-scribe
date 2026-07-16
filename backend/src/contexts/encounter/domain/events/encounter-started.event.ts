import { DomainEvent } from '../../../../shared-kernel';

export class EncounterStarted extends DomainEvent {
  constructor(
    readonly encounterId: string,
    readonly providerRef: string,
    readonly patientRef: string,
  ) {
    super();
  }
}
