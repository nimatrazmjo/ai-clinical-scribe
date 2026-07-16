import { DomainEvent } from './domain-event';
import { Entity } from './entity';
import { UniqueId } from './unique-id';

export abstract class AggregateRoot<TId extends UniqueId> extends Entity<TId> {
  private _events: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this._events.push(event);
  }

  pullEvents(): DomainEvent[] {
    const events = [...this._events];
    this._events = [];
    return events;
  }
}
