import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

// Mot de passe des comptes de démonstration créés par prisma/seed.ts. Il est
// écrit en clair dans le dépôt public : un compte qui l'utilise encore est
// ouvert à tous.
const PUBLISHED_PASSWORDS = ['ChangeMe123!'];

/**
 * En production, suspend au démarrage tout compte dont le mot de passe est
 * celui publié dans le dépôt (seed lancé par erreur sur la vraie base).
 */
@Injectable()
export class DefaultAccountsGuard implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultAccountsGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') return;
    try {
      const candidates = await this.prisma.user.findMany({
        where: {
          email: { endsWith: '@axisimport.com' },
          status: { not: UserStatus.SUSPENDED },
          deletedAt: null,
        },
        select: { id: true, email: true, passwordHash: true },
      });
      for (const u of candidates) {
        for (const pwd of PUBLISHED_PASSWORDS) {
          if (await argon2.verify(u.passwordHash, pwd).catch(() => false)) {
            await this.prisma.user.update({ where: { id: u.id }, data: { status: UserStatus.SUSPENDED } });
            await this.prisma.refreshToken.updateMany({
              where: { userId: u.id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
            this.logger.error(`Compte ${u.email} suspendu : il utilisait le mot de passe publié dans le dépôt.`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Contrôle des comptes de démonstration impossible : ${(err as Error).message}`);
    }
  }
}
