import { DomainException } from '../../../shared-kernel';

export class AccountDeactivatedException extends DomainException {
  constructor() {
    super('Account is deactivated', 'ACCOUNT_DEACTIVATED', 401);
  }
}
