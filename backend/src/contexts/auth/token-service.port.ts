export interface TokenService {
  sign(payload: { sub: string; email: string; role: string }): Promise<string>;
}

export const TOKEN_SERVICE = 'TOKEN_SERVICE';
