import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
