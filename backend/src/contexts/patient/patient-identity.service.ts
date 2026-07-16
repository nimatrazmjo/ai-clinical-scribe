import { Inject, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DomainException } from '../../shared-kernel';
import { CLOCK } from '../../shared-kernel/tokens';
import type { Clock } from '../../shared-kernel';
import { PatientEntity } from './patient.entity';

export function buildMatchKey(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
): string {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  return `${norm(firstName)}|${norm(lastName)}|${dateOfBirth}`;
}

function validateDob(dob: string, now: Date): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    throw new DomainException(
      'Date of birth must be in YYYY-MM-DD format',
      'INVALID_DOB',
      400,
    );
  }
  const dobDate = new Date(`${dob}T00:00:00Z`);
  if (isNaN(dobDate.getTime())) {
    throw new DomainException('Invalid date of birth', 'INVALID_DOB', 400);
  }
  if (dobDate > now) {
    throw new DomainException(
      'Date of birth cannot be in the future',
      'INVALID_DOB',
      400,
    );
  }
  const minDate = new Date(now);
  minDate.setFullYear(now.getFullYear() - 150);
  if (dobDate < minDate) {
    throw new DomainException(
      'Date of birth is implausible (over 150 years ago)',
      'INVALID_DOB',
      400,
    );
  }
}

@Injectable()
export class PatientIdentityService {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async resolveOrCreate(dto: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  }): Promise<PatientEntity> {
    validateDob(dto.dateOfBirth, this.clock.now());

    const matchKey = buildMatchKey(
      dto.firstName,
      dto.lastName,
      dto.dateOfBirth,
    );
    const repo = this.ds.getRepository(PatientEntity);

    const existing = await repo.findOneBy({ matchKey });
    if (existing) return existing;

    try {
      return await repo.save({
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth,
        matchKey,
      });
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const pg = err as QueryFailedError & { code?: string };
        if (pg.code === '23505') {
          // race: another request created the same patient — fetch and return
          return (await repo.findOneBy({ matchKey })) as PatientEntity;
        }
      }
      throw err;
    }
  }
}
