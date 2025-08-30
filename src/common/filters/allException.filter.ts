import { Catch, ArgumentsHost, HttpException, BadRequestException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { DatabaseError } from 'pg';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    let newResponse: object | null = null;
    let status = 500;

    // Handle DTO validation errors
    if (exception instanceof BadRequestException) {
      const exceptionResponse = exception.getResponse();

      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        Array.isArray((exceptionResponse as any).message)
      ) {
        newResponse = {
          ...(exceptionResponse as object),
          message: (exceptionResponse as any).message[0],
        };
        status = exception.getStatus();
      }
    }

    // For unhandled database errors
    if (exception instanceof DatabaseError) {
      newResponse = {
        message: exception.message,
        severity: exception.severity,
        statusCode: 400,
        error: 'Bad Request'
      };
      status = 400;

      Logger.error(exception.message, exception.stack);
    }

    if (newResponse) {
      return response.status(status).json(newResponse);
    }

    super.catch(exception, host);
  }
}