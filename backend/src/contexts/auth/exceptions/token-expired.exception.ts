import { DomainException } from '../../../shared-kernel';

export class TokenExpiredException extends DomainException {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED', 401);
  }
}
