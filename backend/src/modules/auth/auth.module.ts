import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HideAmountsInterceptor } from '../../common/interceptors/hide-amounts.interceptor';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DefaultAccountsGuard } from './default-accounts.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DefaultAccountsGuard,
    JwtStrategy,
    // Limitation du nombre de requêtes par adresse IP. Le module était
    // configuré mais son garde jamais branché : aucune limite ne
    // s'appliquait, pas même aux tentatives de connexion.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Après les gardes (l'utilisateur est connu) : aucun montant pour les responsables.
    { provide: APP_INTERCEPTOR, useClass: HideAmountsInterceptor },
  ],
  exports: [AuthService],
})
export class AuthModule {}
