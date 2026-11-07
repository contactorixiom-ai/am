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
          // Ce message remonte tel quel à l'écran : « Resource already
          // exists » ne disait pas au client quoi corriger.
          message = duplicateMessage(exception.meta?.target);
          code = 'CONFLICT';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Élément introuvable.';
          code = 'NOT_FOUND';
          break;
        default:
          // Le message brut de Prisma décrit la requête SQL et le schéma :
          // il part dans les journaux, pas chez l'utilisateur.
          status = HttpStatus.BAD_REQUEST;
          message = 'Requête invalide.';
          code = exception.code;
          this.logger.warn(`${exception.code} ${exception.message}`);
      }
    } else if (isBodyParserError(exception)) {
      // Erreurs levées avant Nest (corps trop gros, JSON illisible) : elles
      // portent leur propre code HTTP, qui finissait en 500.
      status = exception.status;
      code = exception.type ?? 'BAD_REQUEST';
      message =
        status === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'Fichier trop volumineux (10 Mo maximum).'
          : 'Requête illisible.';
    } else if (exception instanceof Error) {
      // Erreur imprévue : même logique, le détail reste côté serveur.
      message = 'Une erreur est survenue. Réessayez dans un instant.';
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      message = 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
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

function duplicateMessage(target: unknown): string {
  const fields = (Array.isArray(target) ? target : [String(target ?? '')]).join(' ').toLowerCase();
  if (fields.includes('phone')) return 'Ce numéro de téléphone est déjà utilisé par un autre compte.';
  if (fields.includes('email')) return 'Cette adresse e-mail est déjà utilisée par un autre compte.';
  if (fields.includes('plate') || fields.includes('vin')) {
    return 'Ce véhicule (immatriculation ou numéro de série) est déjà enregistré.';
  }
  if (fields.includes('reference')) return 'Cette référence existe déjà.';
  return 'Cet élément existe déjà.';
}

function isBodyParserError(e: unknown): e is Error & { status: number; type?: string } {
  if (!(e instanceof Error)) return false;
  const status = (e as unknown as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500;
}
