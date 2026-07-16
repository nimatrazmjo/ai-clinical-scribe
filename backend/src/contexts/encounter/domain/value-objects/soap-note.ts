import { ValueObject } from '../../../../shared-kernel';
import { DomainException } from '../../../../shared-kernel';
import { Assessment } from './assessment';

export class SoapNote extends ValueObject<{
  subjective: string;
  objective: string;
  assessment: Assessment;
  plan: string;
}> {
  get subjective(): string {
    return this.props.subjective;
  }

  get objective(): string {
    return this.props.objective;
  }

  get assessment(): Assessment {
    return this.props.assessment;
  }

  get plan(): string {
    return this.props.plan;
  }

  static create(
    subjective: string,
    objective: string,
    assessment: Assessment,
    plan: string,
  ): SoapNote {
    if (!subjective.trim()) {
      throw new DomainException(
        'Subjective section is required',
        'SOAP_MISSING_SECTION',
        400,
      );
    }
    if (!objective.trim()) {
      throw new DomainException(
        'Objective section is required',
        'SOAP_MISSING_SECTION',
        400,
      );
    }
    if (!plan.trim()) {
      throw new DomainException(
        'Plan section is required',
        'SOAP_MISSING_SECTION',
        400,
      );
    }
    return new SoapNote({ subjective, objective, assessment, plan });
  }
}
