import { DomainException } from '../../../shared-kernel';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid credentials', 'INVALID_CREDENTIALS', 401);
  }
}
