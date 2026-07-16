import { Logger } from '@nestjs/common';
import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  let hasher: Argon2PasswordHasher;

  beforeEach(() => {
    hasher = new Argon2PasswordHasher();
  });

  it('hash returns a string different from the input', async () => {
    const result = await hasher.hash('MySecret1!');
    expect(result).not.toBe('MySecret1!');
    expect(result.length).toBeGreaterThan(0);
  });

  it('verify returns true for the original password', async () => {
    const hash = await hasher.hash('CorrectPassword');
    expect(await hasher.verify('CorrectPassword', hash)).toBe(true);
  });

  it('verify returns false for the wrong password', async () => {
    const hash = await hasher.hash('CorrectPassword');
    expect(await hasher.verify('WrongPassword', hash)).toBe(false);
  });

  it('produces a unique salt — two hashes of the same input differ', async () => {
    const h1 = await hasher.hash('SameInput');
    const h2 = await hasher.hash('SameInput');
    expect(h1).not.toBe(h2);
  });

  it('verify returns false for a malformed hash without throwing', async () => {
    await expect(
      hasher.verify('anyPassword', 'not-a-valid-hash'),
    ).resolves.toBe(false);
  });

  it('verify returns false for an empty hash without throwing', async () => {
    await expect(hasher.verify('anyPassword', '')).resolves.toBe(false);
  });

  it('never logs the plaintext password', async () => {
    const spies = (['log', 'error', 'warn', 'debug', 'verbose'] as const).map(
      (m) => jest.spyOn(Logger.prototype, m).mockImplementation(() => {}),
    );
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await hasher.hash('SuperSecret123!');

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalledWith(
        expect.stringContaining('SuperSecret123!'),
      );
    }
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('SuperSecret123!'),
    );

    spies.forEach((s) => s.mockRestore());
    consoleSpy.mockRestore();
  });
});
