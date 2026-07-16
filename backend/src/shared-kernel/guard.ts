import { DomainException } from './domain.exception';

export class Guard {
  static againstNullOrUndefined(value: unknown, field: string): void {
    if (value === null || value === undefined) {
      throw new DomainException(`${field} is required`, 'REQUIRED_FIELD');
    }
  }

  static againstEmptyString(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new DomainException(`${field} must not be empty`, 'EMPTY_FIELD');
    }
  }
}
