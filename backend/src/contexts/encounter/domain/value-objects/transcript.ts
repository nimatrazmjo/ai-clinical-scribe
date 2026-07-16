import { ValueObject } from '../../../../shared-kernel';
import { DomainException } from '../../../../shared-kernel';

export class Transcript extends ValueObject<{ text: string }> {
  static readonly MAX_CHARS = 50_000;

  get text(): string {
    return this.props.text;
  }

  static create(text: string): Transcript {
    if (!text || text.trim().length === 0) {
      throw new DomainException(
        'Transcript cannot be empty',
        'TRANSCRIPT_EMPTY',
        400,
      );
    }
    if (text.length > Transcript.MAX_CHARS) {
      throw new DomainException(
        `Transcript exceeds the ${Transcript.MAX_CHARS.toLocaleString()} character limit`,
        'TRANSCRIPT_TOO_LONG',
        400,
      );
    }
    return new Transcript({ text });
  }
}
