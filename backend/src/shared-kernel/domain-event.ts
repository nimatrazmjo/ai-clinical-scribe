export abstract class DomainEvent {
  readonly occurredAt: Date;

  constructor(occurredAt?: Date) {
    this.occurredAt = occurredAt ?? new Date();
  }
}
