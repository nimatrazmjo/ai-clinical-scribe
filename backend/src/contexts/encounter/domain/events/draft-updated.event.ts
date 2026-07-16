import { DomainEvent } from '../../../../shared-kernel';

export class DraftUpdated extends DomainEvent {
  constructor(readonly encounterId: string) {
    super();
  }
}
