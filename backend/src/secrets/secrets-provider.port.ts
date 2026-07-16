export interface SecretsProvider {
  get(key: string): Promise<string>;
}

export const SECRETS_PROVIDER = 'SECRETS_PROVIDER';
