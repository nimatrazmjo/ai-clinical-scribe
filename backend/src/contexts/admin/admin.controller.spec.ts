import { NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UserRole } from '../identity/user.entity';

const makeUserRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findById: jest.fn(),
  findByRole: jest.fn(),
  save: jest.fn(),
  setActive: jest.fn(),
  ...overrides,
});

const makeEncounterRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findByFilter: jest.fn(),
  ...overrides,
});

const makeHasher = () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
  verify: jest.fn(),
});

function makeController(
  userRepo = makeUserRepo(),
  encounterRepo = makeEncounterRepo(),
  hasher = makeHasher(),
) {
  return new AdminController(
    userRepo as never,
    encounterRepo as never,
    hasher,
  );
}

describe('AdminController', () => {
  describe('listEncounters', () => {
    it('returns mapped encounter list', async () => {
      const fakeEncounters = [
        {
          id: { value: 'enc-1' },
          patientRef: { value: 'pat-1' },
          providerRef: { value: 'prov-1' },
          status: 'draft',
          createdAt: new Date('2026-01-01'),
        },
      ];
      const repo = makeEncounterRepo({
        findByFilter: jest.fn().mockResolvedValue(fakeEncounters),
      });
      const ctrl = makeController(undefined, repo);
      const result = await ctrl.listEncounters();
      expect(repo.findByFilter).toHaveBeenCalledWith({ providerId: undefined, from: undefined, to: undefined });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('enc-1');
    });

    it('passes parsed date filters', async () => {
      const repo = makeEncounterRepo({ findByFilter: jest.fn().mockResolvedValue([]) });
      const ctrl = makeController(undefined, repo);
      await ctrl.listEncounters('prov-1', '2026-01-01', '2026-02-01');
      expect(repo.findByFilter).toHaveBeenCalledWith({
        providerId: 'prov-1',
        from: new Date('2026-01-01'),
        to: new Date('2026-02-01'),
      });
    });
  });

  describe('createProvider', () => {
    it('hashes password and saves user with PROVIDER role', async () => {
      const savedUser = {
        id: 'new-id',
        email: 'dr.test@clinic.com',
        firstName: 'Test',
        lastName: 'Doc',
        role: UserRole.PROVIDER,
        isActive: true,
        passwordHash: '$argon2id$hashed',
        createdAt: new Date(),
      };
      const userRepo = makeUserRepo({ save: jest.fn().mockResolvedValue(savedUser) });
      const hasher = makeHasher();
      const ctrl = makeController(userRepo, undefined, hasher);

      const result = await ctrl.createProvider({
        email: 'dr.test@clinic.com',
        firstName: 'Test',
        lastName: 'Doc',
        password: 'Secret123!',
      });

      expect(hasher.hash).toHaveBeenCalledWith('Secret123!');
      expect(userRepo.save).toHaveBeenCalled();
      const savedArg = (userRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedArg.role).toBe(UserRole.PROVIDER);
      expect(savedArg.passwordHash).toBe('$argon2id$hashed');
      expect(result.email).toBe('dr.test@clinic.com');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('listProviders', () => {
    it('returns all providers mapped without passwordHash', async () => {
      const providers = [
        {
          id: 'p-1', email: 'dr@clinic.com', firstName: 'Dr', lastName: 'A',
          isActive: true, createdAt: new Date(), passwordHash: 'secret',
        },
      ];
      const userRepo = makeUserRepo({ findByRole: jest.fn().mockResolvedValue(providers) });
      const ctrl = makeController(userRepo);
      const result = await ctrl.listProviders();
      expect(userRepo.findByRole).toHaveBeenCalledWith(UserRole.PROVIDER);
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0].email).toBe('dr@clinic.com');
    });
  });

  describe('deactivateProvider', () => {
    it('sets isActive=false for existing provider', async () => {
      const provider = { id: 'p-1', role: UserRole.PROVIDER, isActive: true };
      const userRepo = makeUserRepo({
        findById: jest.fn().mockResolvedValue(provider),
        setActive: jest.fn().mockResolvedValue(undefined),
      });
      const ctrl = makeController(userRepo);
      const result = await ctrl.deactivateProvider('p-1');
      expect(userRepo.setActive).toHaveBeenCalledWith('p-1', false);
      expect(result.ok).toBe(true);
    });

    it('throws NotFoundException for unknown id', async () => {
      const userRepo = makeUserRepo({ findById: jest.fn().mockResolvedValue(null) });
      const ctrl = makeController(userRepo);
      await expect(ctrl.deactivateProvider('no-such-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if user is not a PROVIDER', async () => {
      const admin = { id: 'a-1', role: UserRole.ADMIN };
      const userRepo = makeUserRepo({ findById: jest.fn().mockResolvedValue(admin) });
      const ctrl = makeController(userRepo);
      await expect(ctrl.deactivateProvider('a-1')).rejects.toThrow(NotFoundException);
    });
  });
});
