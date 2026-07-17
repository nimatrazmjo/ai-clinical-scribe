import { DomainEvent } from '../../../../shared-kernel';

export class NoteSaved extends DomainEvent {
  constructor(
    public readonly encounterId: string,
    public readonly versionNo: number,
    public readonly savedBy: string,
  ) {
    super();
  }
}
