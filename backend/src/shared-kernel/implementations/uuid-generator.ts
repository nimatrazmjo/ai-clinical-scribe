import { randomUUID } from 'crypto';
import { IdGenerator } from '../ports/id-generator.port';

export class UuidGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }
}
