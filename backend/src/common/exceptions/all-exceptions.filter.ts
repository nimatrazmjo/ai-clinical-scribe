import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from './domain.exception';

interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const envelope = this.toEnvelope(exception);
    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      let message: string;
      let code: string;

      if (typeof res === 'string') {
        message = res;
        code = 'HTTP_ERROR';
      } else {
        const body = res as Record<string, unknown>;
        const rawMsg = body['message'];
        message = Array.isArray(rawMsg)
          ? (rawMsg as string[]).join('; ')
          : typeof rawMsg === 'string'
            ? rawMsg
            : exception.message;
        const rawCode = body['error'];
        code =
          typeof rawCode === 'string'
            ? rawCode.toUpperCase().replace(/\s+/g, '_')
            : 'HTTP_ERROR';
      }

      return { statusCode: status, code, message };
    }

    if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }
}
