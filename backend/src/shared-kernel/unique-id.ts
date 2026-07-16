import { DomainException } from './domain.exception';

export abstract class UniqueId {
  readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new DomainException('ID value must not be empty', 'INVALID_ID');
    }
    this.value = value;
  }

  equals(other: UniqueId): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
