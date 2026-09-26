import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { assertProductionSecrets } from './common/security/assert-secrets';
import { frenchValidationErrors } from './common/validation/french-errors';

async function bootstrap() {
  // Avant toute chose : un serveur signé avec une clé connue est un serveur
  // où n'importe qui peut se faire passer pour l'administrateur.
  assertProductionSecrets();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // Railway place l'API derrière un proxy : sans cela, toutes les requêtes
  // semblent venir de la même adresse et la limitation de débit bloquerait
  // tout le monde à la fois.
  app.set('trust proxy', 1);
  // Les fichiers (pièces d'identité, photos d'état des lieux, documents de
  // douane) arrivent encodés en base64 dans le corps JSON. La limite par
  // défaut d'Express, 100 Ko, refusait toute photo prise au téléphone.
  // 15 Mo couvrent un fichier de 10 Mo (plafond du stockage) une fois encodé.
  app.useBodyParser('json', { limit: '15mb' });
  const config = app.get(ConfigService);

  const port = config.get<number>('port', 3000);
  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');

  app.setGlobalPrefix(apiPrefix);

  // CORS ultra-permissif en middleware brut.
  // Sans credentials (l'app utilise Authorization: Bearer en header, pas de
  // cookies) on peut renvoyer un Access-Control-Allow-Origin: * littéral
  // qui est accepté par TOUS les navigateurs sans condition.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: frenchValidationErrors,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Axis Import API')
    .setDescription(
      'Plateforme de convoyage automobile et import-export Europe ↔ Afrique subsaharienne francophone.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('vehicles')
    .addTag('missions')
    .addTag('quotes')
    .addTag('gps')
    .addTag('inspections')
    .addTag('documents')
    .addTag('messaging')
    .addTag('parcels')
    .addTag('news')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  app.enableShutdownHooks();

  // Écouter sur 0.0.0.0 (pas localhost) pour que le conteneur Docker
  // Railway puisse joindre l'app depuis l'extérieur.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 Axis Import API ready on port ${port}, prefix /${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`📘 Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap();
