import {
  buildMatchKey,
  PatientIdentityService,
} from './patient-identity.service';
import { DomainException } from '../../shared-kernel';
import { FixedClock } from '../../shared-kernel';

const NOW = new Date('2026-07-16T12:00:00Z');
const FIXED_CLOCK = new FixedClock(NOW);

function makeService(
  findOneByCb: () => Promise<unknown>,
  saveCb: () => Promise<unknown>,
): PatientIdentityService {
  const ds = {
    getRepository: () => ({
      findOneBy: findOneByCb,
      save: saveCb,
    }),
  };
  return new PatientIdentityService(ds as never, FIXED_CLOCK);
}

describe('buildMatchKey', () => {
  it('lowercases first and last name', () => {
    expect(buildMatchKey('ALICE', 'SMITH', '1990-01-01')).toBe(
      'alice|smith|1990-01-01',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(buildMatchKey('  Alice  ', '  Smith  ', '1990-01-01')).toBe(
      'alice|smith|1990-01-01',
    );
  });

  it('collapses internal whitespace', () => {
    expect(buildMatchKey('Alice  Marie', 'Van  Der  Berg', '1990-01-01')).toBe(
      'alice marie|van der berg|1990-01-01',
    );
  });

  it('strips diacritics (E-10)', () => {
    expect(buildMatchKey('Élise', 'Müller', '1990-01-01')).toBe(
      'elise|muller|1990-01-01',
    );
  });

  it('same name with and without accents produces the same key (E-10)', () => {
    expect(buildMatchKey('Jose', 'Garcia', '2000-05-10')).toBe(
      buildMatchKey('José', 'García', '2000-05-10'),
    );
  });

  it('different DOB produces a different key (E-12)', () => {
    const k1 = buildMatchKey('Alice', 'Smith', '1990-01-01');
    const k2 = buildMatchKey('Alice', 'Smith', '1991-01-01');
    expect(k1).not.toBe(k2);
  });
});

describe('PatientIdentityService.resolveOrCreate', () => {
  const validDto = {
    firstName: 'Alice',
    lastName: 'Smith',
    dateOfBirth: '1990-06-15',
  };

  it('returns existing patient when match key already exists (E-09)', async () => {
    const existing = { id: 'p-1', ...validDto };
    const svc = makeService(
      () => Promise.resolve(existing),
      () => Promise.reject(new Error('should not save')),
    );
    const result = await svc.resolveOrCreate(validDto);
    expect(result).toBe(existing);
  });

  it('creates a new patient when no match exists', async () => {
    const saved = { id: 'p-2', ...validDto };
    const svc = makeService(
      () => Promise.resolve(null),
      () => Promise.resolve(saved),
    );
    const result = await svc.resolveOrCreate(validDto);
    expect(result).toBe(saved);
  });

  it('throws INVALID_DOB for a future date (E-11)', async () => {
    const svc = makeService(
      () => Promise.resolve(null),
      () => Promise.resolve(null),
    );
    await expect(
      svc.resolveOrCreate({
        ...validDto,
        dateOfBirth: '2099-01-01',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DOB' });
  });

  it('throws INVALID_DOB for a date over 150 years ago (E-11)', async () => {
    const svc = makeService(
      () => Promise.resolve(null),
      () => Promise.resolve(null),
    );
    await expect(
      svc.resolveOrCreate({
        ...validDto,
        dateOfBirth: '1800-01-01',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_DOB' });
  });

  it('throws INVALID_DOB for a malformed date', async () => {
    const svc = makeService(
      () => Promise.resolve(null),
      () => Promise.resolve(null),
    );
    await expect(
      svc.resolveOrCreate({ ...validDto, dateOfBirth: 'not-a-date' }),
    ).rejects.toBeInstanceOf(DomainException);
  });

  it('accepts today as a valid DOB (boundary: day of birth)', async () => {
    const todayStr = NOW.toISOString().slice(0, 10);
    const saved = { id: 'p-3', ...validDto, dateOfBirth: todayStr };
    const svc = makeService(
      () => Promise.resolve(null),
      () => Promise.resolve(saved),
    );
    const result = await svc.resolveOrCreate({
      ...validDto,
      dateOfBirth: todayStr,
    });
    expect(result).toBe(saved);
  });
});
