export type ErrorCode =
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorEnvelope {
  statusCode: number;
  code: ErrorCode;
  message: string;
}
