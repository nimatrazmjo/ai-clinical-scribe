import { UniqueId } from './unique-id';

export abstract class Entity<TId extends UniqueId> {
  constructor(readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return this.id.equals(other.id);
  }
}
