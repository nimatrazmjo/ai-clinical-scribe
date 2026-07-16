import { IdGenerator } from '../ports/id-generator.port';

export class SeqIdGenerator implements IdGenerator {
  private counter = 0;

  uuid(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }

  reset(): void {
    this.counter = 0;
  }
}
