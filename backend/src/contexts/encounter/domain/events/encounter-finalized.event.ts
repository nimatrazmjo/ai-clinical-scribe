import { DomainEvent } from '../../../../shared-kernel';

export class EncounterFinalized extends DomainEvent {
  constructor(
    readonly encounterId: string,
    readonly providerRef: string,
  ) {
    super();
  }
}
