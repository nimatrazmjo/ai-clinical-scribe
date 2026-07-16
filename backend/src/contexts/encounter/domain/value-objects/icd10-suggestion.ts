import { ValueObject } from '../../../../shared-kernel';
import { DomainException } from '../../../../shared-kernel';

export class Icd10Suggestion extends ValueObject<{
  code: string;
  description: string;
}> {
  get code(): string {
    return this.props.code;
  }

  get description(): string {
    return this.props.description;
  }

  static create(code: string, description: string): Icd10Suggestion {
    if (!code.trim()) {
      throw new DomainException(
        'ICD-10 code is required',
        'INVALID_ICD10',
        400,
      );
    }
    if (!description.trim()) {
      throw new DomainException(
        'ICD-10 description is required',
        'INVALID_ICD10',
        400,
      );
    }
    return new Icd10Suggestion({
      code: code.trim().toUpperCase(),
      description: description.trim(),
    });
  }
}
