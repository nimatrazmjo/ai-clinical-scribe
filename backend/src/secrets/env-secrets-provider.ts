import { Injectable } from '@nestjs/common';
import { SecretsProvider } from './secrets-provider.port';

@Injectable()
export class EnvSecretsProvider implements SecretsProvider {
  get(key: string): Promise<string> {
    const value = process.env[key];
    if (value === undefined || value === '') {
      return Promise.reject(new Error(`Missing required config key: ${key}`));
    }
    return Promise.resolve(value);
  }
}
