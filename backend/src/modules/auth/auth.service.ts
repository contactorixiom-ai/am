import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { MailService } from './mail.service';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: User['role'];
    status: UserStatus;
  };
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  current: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // Lien demandé par l'utilisateur lui-même : court, il transite par e-mail.
  private static readonly RESET_TTL_MS = 60 * 60 * 1000;
  // Lien d'accès créé par l'administrateur (activation d'un compte saisi au
  // téléphone) : le client peut ne l'ouvrir que quelques jours plus tard.
  private static readonly ACCESS_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  async register(dto: RegisterDto): Promise<AuthResult> {
    // Ceinture et bretelles : même si la validation du DTO venait à changer,
    // l'inscription publique ne crée jamais d'administrateur.
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Ce rôle ne peut pas être choisi à l\'inscription.');
    }
    // L'adresse était cherchée telle quelle mais enregistrée en minuscules :
    // « Marc@Ex.fr » passait la vérification puis heurtait la contrainte
    // d'unicité, et l'utilisateur recevait une erreur 500 au lieu d'un
    // message clair.
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez « Mot de passe oublié ».');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone?.trim(),
        role: dto.role,
        accountType: dto.accountType,
        companyName: dto.companyName?.trim(),
        status: UserStatus.PENDING,
      },
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto, meta?: { userAgent?: string; ipAddress?: string }): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user) throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Ce compte n\'est pas actif. Contactez Axis Import.');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('E-mail ou mot de passe incorrect.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.buildAuthResult(user, meta);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    }
    // Rotate
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const { accessToken, refreshToken: newRefresh, expiresIn } = await this.issueTokens(stored.user);
    return { accessToken, refreshToken: newRefresh, expiresIn };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Liste les sessions actives (refresh tokens non révoqués et non expirés). */
  async listSessions(userId: string, currentRefreshToken?: string): Promise<SessionInfo[]> {
    const currentHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : undefined;
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return tokens.map((t) => ({
      id: t.id,
      userAgent: t.userAgent,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      current: currentHash ? t.tokenHash === currentHash : false,
    }));
  }

  /** Révoque une session précise (déconnecte l'appareil correspondant). */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const token = await this.prisma.refreshToken.findUnique({ where: { id: sessionId } });
    if (!token || token.userId !== userId) {
      throw new NotFoundException('Session introuvable');
    }
    if (token.revokedAt) return;
    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * « Mot de passe oublié ». La réponse est identique que l'adresse existe
   * ou non : elle ne doit pas permettre de savoir qui est client.
   */
  async requestPasswordReset(rawEmail: string): Promise<{ emailSent: boolean }> {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
      return { emailSent: this.mail.enabled };
    }
    const { url } = await this.createResetToken(user.id, AuthService.RESET_TTL_MS);
    await this.mail.send({
      to: user.email,
      subject: 'Axis Import — choisir un nouveau mot de passe',
      text:
        `Bonjour ${user.firstName},\n\n` +
        `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${url}\n\n` +
        `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : ` +
        `votre mot de passe actuel reste valable.\n\nAxis Import`,
      html:
        `<p>Bonjour ${escapeHtml(user.firstName)},</p>` +
        `<p>Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :</p>` +
        `<p><a href="${escapeHtml(url)}">Choisir mon mot de passe</a></p>` +
        `<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : ` +
        `votre mot de passe actuel reste valable.</p><p>Axis Import</p>`,
    });
    return { emailSent: this.mail.enabled };
  }

  /**
   * Lien d'accès créé par l'administrateur, à transmettre au client par
   * WhatsApp ou SMS. C'est le seul moyen pour un client dont le compte a été
   * saisi par Axis de se connecter : son mot de passe initial est aléatoire.
   */
  async createAccessLink(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status === UserStatus.DELETED) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.role === UserRole.ADMIN) {
      // Un administrateur ne doit pas pouvoir prendre la main sur le compte
      // d'un autre administrateur par ce biais.
      throw new BadRequestException('Impossible pour un compte administrateur.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Ce compte est suspendu.');
    }
    const link = await this.createResetToken(userId, AuthService.ACCESS_LINK_TTL_MS, adminId);
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'ACCESS_LINK_CREATE',
        entity: 'User',
        entityId: userId,
      },
    });
    return {
      ...link,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
    };
  }

  /** Définit le mot de passe à partir d'un lien, puis connecte l'utilisateur. */
  async resetPassword(token: string, password: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException(
        'Ce lien n\'est plus valable. Demandez-en un nouveau depuis « Mot de passe oublié ».',
      );
    }
    const user = stored.user;
    if (user.deletedAt || user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
      throw new BadRequestException('Ce compte n\'est pas actif.');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
          // Un lien reçu par e-mail prouve que l'adresse appartient bien au
          // titulaire ; un lien transmis par l'administrateur, non.
          ...(stored.createdBy ? {} : { emailVerifiedAt: user.emailVerifiedAt ?? now }),
        },
      }),
      // Le lien est à usage unique, et tous les autres liens en cours
      // deviennent caducs.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      // Quiconque était connecté avec l'ancien mot de passe est déconnecté.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    return this.buildAuthResult(updated);
  }

  private async createResetToken(userId: string, ttlMs: number, createdBy?: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash: this.hashToken(token), expiresAt, createdBy },
    });
    const base = this.config.get<string>('appUrl', 'https://contactorixiom-ai.github.io/am/app/');
    return { url: `${base}?reinitialisation=${token}`, expiresAt };
  }

  private async buildAuthResult(
    user: User,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const tokens = await this.issueTokens(user, meta);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    };
  }

  private async issueTokens(
    user: User,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('hex');

    const ttlDays = parseInt(this.config.get<string>('jwt.refreshExpiresIn', '30d'), 10) || 30;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDurationSec(this.config.get<string>('jwt.expiresIn', '15m')),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationSec(value: string): number {
    const match = value.match(/^(\d+)([smhd])?$/);
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return n;
      case 'h': return n * 3600;
      case 'd': return n * 86400;
      case 'm':
      default: return n * 60;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
