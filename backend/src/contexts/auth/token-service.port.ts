export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export type TokenVerifyResult =
  | { status: 'ok'; payload: TokenPayload }
  | { status: 'expired' }
  | { status: 'invalid' };

export interface TokenService {
  sign(payload: { sub: string; email: string; role: string }): Promise<string>;
  verify(token: string): Promise<TokenVerifyResult>;
}

export const TOKEN_SERVICE = 'TOKEN_SERVICE';
