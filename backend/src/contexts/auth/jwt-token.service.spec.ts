import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service';
import { SECRETS_PROVIDER } from '../../secrets/secrets-provider.port';
import { CLOCK } from '../../shared-kernel/tokens';
import { FixedClock } from '../../shared-kernel';

describe('JwtTokenService', () => {
  const FIXED_NOW = new Date('2025-01-01T00:00:00.000Z');
  const FIXED_IAT = Math.floor(FIXED_NOW.getTime() / 1000);
  const FIXED_EXP = FIXED_IAT + 8 * 60 * 60;

  let service: JwtTokenService;
  let signAsync: jest.Mock;
  let verifyAsync: jest.Mock;

  beforeEach(async () => {
    signAsync = jest.fn().mockResolvedValue('signed.jwt.token');
    verifyAsync = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtTokenService,
        { provide: JwtService, useValue: { signAsync, verifyAsync } },
        {
          provide: SECRETS_PROVIDER,
          useValue: { get: jest.fn().mockResolvedValue('test-secret') },
        },
        { provide: CLOCK, useValue: new FixedClock(FIXED_NOW) },
      ],
    }).compile();

    service = moduleRef.get(JwtTokenService);
  });

  describe('sign', () => {
    it('returns the signed token string', async () => {
      const token = await service.sign({
        sub: 'u1',
        email: 'a@b.com',
        role: 'provider',
      });
      expect(token).toBe('signed.jwt.token');
    });

    it('calls signAsync with correct payload and secret', async () => {
      await service.sign({ sub: 'u1', email: 'a@b.com', role: 'provider' });
      expect(signAsync).toHaveBeenCalledWith(
        {
          sub: 'u1',
          email: 'a@b.com',
          role: 'provider',
          iat: FIXED_IAT,
          exp: FIXED_EXP,
        },
        { secret: 'test-secret' },
      );
    });

    it('sets exp to 8 hours after iat', async () => {
      await service.sign({ sub: 'u1', email: 'a@b.com', role: 'provider' });
      const call = signAsync.mock.calls[0] as [
        { iat: number; exp: number },
        unknown,
      ];
      expect(call[0].exp - call[0].iat).toBe(8 * 60 * 60);
    });
  });

  describe('verify', () => {
    it('returns ok with payload for a valid token', async () => {
      const payload = {
        sub: 'u1',
        email: 'a@b.com',
        role: 'provider',
        iat: FIXED_IAT,
        exp: FIXED_EXP,
      };
      verifyAsync.mockResolvedValue(payload);
      const result = await service.verify('valid.jwt.token');
      expect(result).toEqual({ status: 'ok', payload });
    });

    it('returns expired when TokenExpiredError is thrown', async () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      verifyAsync.mockRejectedValue(err);
      const result = await service.verify('expired.token');
      expect(result).toEqual({ status: 'expired' });
    });

    it('returns invalid for malformed token', async () => {
      verifyAsync.mockRejectedValue(new Error('invalid signature'));
      const result = await service.verify('bad.token');
      expect(result).toEqual({ status: 'invalid' });
    });
  });
});
