import { DomainException } from '../../../shared-kernel';

export class MissingTokenException extends DomainException {
  constructor() {
    super('Missing authentication token', 'MISSING_TOKEN', 401);
  }
}
