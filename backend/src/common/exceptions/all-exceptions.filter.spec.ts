import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { DomainException } from './domain.exception';

interface Envelope {
  statusCode: number;
  code: string;
  message: string;
}

function buildHost(): {
  host: ArgumentsHost;
  status: () => number;
  body: () => Envelope;
} {
  let lastStatus = 0;
  let lastBody: Envelope = { statusCode: 0, code: '', message: '' };

  const mockRes = {
    status(s: number) {
      lastStatus = s;
      return mockRes;
    },
    json(b: Envelope) {
      lastBody = b;
      return mockRes;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => mockRes,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  return { host, status: () => lastStatus, body: () => lastBody };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('maps DomainException to its own statusCode and code', () => {
    const { host, status, body } = buildHost();
    filter.catch(
      new DomainException('entity not found', 'NOT_FOUND', 404),
      host,
    );
    expect(status()).toBe(404);
    expect(body()).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'entity not found',
    });
  });

  it('maps DomainException with default statusCode 400', () => {
    const { host, status, body } = buildHost();
    filter.catch(
      new DomainException('invalid input', 'VALIDATION_ERROR'),
      host,
    );
    expect(status()).toBe(400);
    expect(body().code).toBe('VALIDATION_ERROR');
  });

  it('maps HttpException with string response', () => {
    const { host, status, body } = buildHost();
    filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);
    expect(status()).toBe(403);
    expect(body().statusCode).toBe(403);
  });

  it('maps ValidationPipe BadRequestException (array message) to joined string', () => {
    const { host, status, body } = buildHost();
    const ex = new BadRequestException({
      statusCode: 400,
      message: ['name must be a string', 'unknown field is not allowed'],
      error: 'Bad Request',
    });
    filter.catch(ex, host);
    expect(status()).toBe(400);
    expect(body().message).toBe(
      'name must be a string; unknown field is not allowed',
    );
    expect(body().code).toBe('BAD_REQUEST');
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking the message (E-45)', () => {
    const { host, status, body } = buildHost();
    filter.catch(new Error('DB connection string: host=secret-host'), host);
    expect(status()).toBe(500);
    expect(body().statusCode).toBe(500);
    expect(body().code).toBe('INTERNAL_ERROR');
    expect(body().message).toBe('An unexpected error occurred');
    expect(JSON.stringify(body())).not.toContain('secret-host');
    expect(JSON.stringify(body())).not.toContain('stack');
  });

  it('returns sanitized envelope for thrown non-Error values (E-45)', () => {
    const { host, status, body } = buildHost();
    filter.catch('unexpected string thrown', host);
    expect(status()).toBe(500);
    expect(body().code).toBe('INTERNAL_ERROR');
  });
});
