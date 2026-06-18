import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { MissionsModule } from './modules/missions/missions.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { RelayPointsModule } from './modules/relay-points/relay-points.module';
import { GpsModule } from './modules/gps/gps.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ParcelsModule } from './modules/parcels/parcels.module';
import { NewsModule } from './modules/news/news.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CustomsModule } from './modules/customs/customs.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('logLevel', 'info'),
          transport:
            config.get<string>('nodeEnv') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60) * 1000,
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),
    PrismaModule,
    StorageModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    MissionsModule,
    QuotesModule,
    RelayPointsModule,
    GpsModule,
    InspectionsModule,
    DocumentsModule,
    MessagingModule,
    ParcelsModule,
    NewsModule,
    PaymentsModule,
    CustomsModule,
  ],
})
export class AppModule {}
