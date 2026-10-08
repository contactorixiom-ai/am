import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

// Mot de passe des comptes de démonstration créés par prisma/seed.ts. Il est
// écrit en clair dans le dépôt public : un compte qui l'utilise encore est
// ouvert à tous.
const PUBLISHED_PASSWORDS = ['ChangeMe123!'];

/**
 * ADMIN_EMAILS (variable Railway, adresses séparées par des virgules) : au
 * démarrage, les comptes EXISTANTS portant ces adresses deviennent
 * administrateurs. Évite une commande en ligne pour promouvoir Roger. Seuls
 * les comptes déjà inscrits sont promus : s'inscrire d'abord, ajouter la
 * variable ensuite (sinon quelqu'un pourrait créer le compte à sa place).
 *
 * En production, suspend aussi au démarrage tout compte dont le mot de passe est
 * celui publié dans le dépôt (seed lancé par erreur sur la vraie base).
 */
@Injectable()
export class DefaultAccountsGuard implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultAccountsGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  private async promoteConfiguredAdmins(): Promise<void> {
    const emails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;
    try {
      const res = await this.prisma.user.updateMany({
        where: { email: { in: emails }, role: { not: UserRole.ADMIN }, deletedAt: null },
        data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      });
      if (res.count > 0) this.logger.log(`${res.count} compte(s) passé(s) administrateur via ADMIN_EMAILS.`);
      const found = await this.prisma.user.count({ where: { email: { in: emails } } });
      if (found < emails.length) {
        this.logger.warn('ADMIN_EMAILS : une adresse ne correspond à aucun compte. Inscrivez-vous d\'abord dans l\'application.');
      }
    } catch (err) {
      this.logger.warn(`ADMIN_EMAILS non appliqué : ${(err as Error).message}`);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.promoteConfiguredAdmins();
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
