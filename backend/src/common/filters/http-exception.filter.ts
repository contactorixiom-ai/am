import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'string') {
        message = r;
      } else if (typeof r === 'object' && r !== null) {
        const obj = r as Record<string, unknown>;
        message = (obj.message as string | string[]) ?? exception.message;
        code = (obj.code as string) ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Resource already exists';
          code = 'CONFLICT';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          code = 'NOT_FOUND';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = exception.message;
          code = exception.code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
