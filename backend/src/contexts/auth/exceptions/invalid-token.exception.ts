import { DomainException } from '../../../shared-kernel';

export class InvalidTokenException extends DomainException {
  constructor() {
    super('Invalid token', 'INVALID_TOKEN', 401);
  }
}
