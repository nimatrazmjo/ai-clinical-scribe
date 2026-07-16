import { ValueObject } from '../../../../shared-kernel';
import { DomainException } from '../../../../shared-kernel';
import { Icd10Suggestion } from './icd10-suggestion';

export class Assessment extends ValueObject<{
  text: string;
  icd10: Icd10Suggestion[];
}> {
  get text(): string {
    return this.props.text;
  }

  get icd10(): Icd10Suggestion[] {
    return this.props.icd10;
  }

  static create(text: string, icd10: Icd10Suggestion[]): Assessment {
    if (icd10.length === 0) {
      throw new DomainException(
        'Assessment must include at least one ICD-10 code',
        'ASSESSMENT_NO_ICD10',
        400,
      );
    }
    return new Assessment({ text, icd10 });
  }
}
