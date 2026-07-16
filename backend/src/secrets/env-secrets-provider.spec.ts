import { EnvSecretsProvider } from './env-secrets-provider';

describe('EnvSecretsProvider (E-41)', () => {
  let provider: EnvSecretsProvider;
  const KEY = 'TEST_SECRET_KEY_BE03';

  beforeEach(() => {
    provider = new EnvSecretsProvider();
    delete process.env[KEY];
  });

  afterEach(() => {
    delete process.env[KEY];
  });

  it('returns the env var value when present', async () => {
    process.env[KEY] = 'secret-value';
    await expect(provider.get(KEY)).resolves.toBe('secret-value');
  });

  it('throws a descriptive Error when the key is absent', async () => {
    await expect(provider.get(KEY)).rejects.toThrow(
      `Missing required config key: ${KEY}`,
    );
  });

  it('throws when the key exists but is empty string', async () => {
    process.env[KEY] = '';
    await expect(provider.get(KEY)).rejects.toThrow(
      `Missing required config key: ${KEY}`,
    );
  });
});
