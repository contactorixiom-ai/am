import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import Stripe from 'stripe';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateCheckoutInput {
  amountCents: number;
  currency?: string;
  reference?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  missionId?: string;
  parcelId?: string;
}

const SIM_PREFIX = 'cs_sim_';

/** Au-delà, une session Checkout abandonnée ne sera plus jamais payée. */
const RECONCILE_WINDOW_DAYS = 7;
/** Garde-fou : on ne réinterroge pas Stripe plus de N fois par requête. */
const RECONCILE_MAX = 20;

/**
 * Paiements via Stripe Checkout (cartes + Apple Pay + Google Pay + Link activés
 * automatiquement selon la configuration du compte Stripe). Aucune donnée
 * bancaire ne transite par notre API : Stripe héberge la page de paiement.
 *
 * Tant que STRIPE_SECRET_KEY n'est pas fourni (variable d'environnement Railway),
 * le service tourne en mode SIMULATION : il renvoie directement l'URL de succès,
 * sans aucun débit — l'app reste démontrable de bout en bout.
 *
 * Chaque session est enregistrée en base : c'est la seule trace qui permette à
 * l'administrateur de savoir qui a payé, et au client de retrouver ses factures
 * réglées sur un autre téléphone.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;
  private readonly defaultCurrency: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    const key = config.get<string>('stripe.secretKey');
    this.defaultCurrency = config.get<string>('stripe.currency', 'eur');
    this.stripe = key ? new Stripe(key) : null;
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY absent — paiements en mode SIMULATION (aucun débit réel).',
      );
    }
  }

  get configured(): boolean {
    return this.stripe !== null;
  }

  async createCheckoutSession(clientId: string, input: CreateCheckoutInput) {
    const amount = Math.round(input.amountCents);
    if (!Number.isFinite(amount) || amount < 100) {
      throw new BadRequestException('Montant invalide (minimum 1,00).');
    }
    const currency = (input.currency ?? this.defaultCurrency).toLowerCase();

    // On rattache le règlement à l'envoi, mais seulement s'il appartient bien
    // au client : un identifiant venu du téléphone ne fait pas foi.
    const missionId = await this.ownedMissionId(clientId, input.missionId);
    const parcelId = await this.ownedParcelId(clientId, input.parcelId);

    let provider: 'stripe' | 'simulation';
    let id: string;
    let url: string | null;

    if (!this.stripe) {
      // Mode simulation : on renvoie l'URL de succès (aucun débit).
      provider = 'simulation';
      id = `${SIM_PREFIX}${Date.now()}`;
      url = input.successUrl.replace('{CHECKOUT_SESSION_ID}', id);
    } else {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: { name: input.description || 'Commande Axis Import' },
            },
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.reference,
        metadata: {
          ...(input.reference ? { reference: input.reference } : {}),
          ...(missionId ? { missionId } : {}),
          ...(parcelId ? { parcelId } : {}),
        },
      });
      provider = 'stripe';
      id = session.id;
      url = session.url;
    }

    // L'enregistrement ne doit jamais faire échouer un paiement déjà engagé
    // chez Stripe : en cas de souci base, on journalise et on laisse passer.
    try {
      await this.prisma.payment.create({
        data: {
          clientId,
          missionId,
          parcelId,
          sessionId: id,
          provider,
          reference: input.reference,
          description: input.description,
          amountCents: amount,
          currency: currency.toUpperCase(),
          // En simulation, aucun débit n'a lieu mais le parcours est validé :
          // on l'enregistre comme payé pour que les écrans restent cohérents.
          status: provider === 'simulation' ? PaymentStatus.PAID : PaymentStatus.PENDING,
          paidAt: provider === 'simulation' ? new Date() : null,
        },
      });
    } catch (e) {
      this.logger.error(`Session ${id} non enregistrée : ${(e as Error).message}`);
    }

    return { provider, configured: this.configured, id, url };
  }

  /**
   * Statut d'une session. Appelé au retour de la page Stripe : c'est ici que
   * le paiement est confirmé et enregistré.
   */
  async getSession(id: string, user: AuthenticatedUser) {
    const record = await this.prisma.payment.findUnique({ where: { sessionId: id } });
    if (record && record.clientId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Ce paiement ne vous appartient pas.');
    }

    if (!this.stripe || id.startsWith(SIM_PREFIX)) {
      // Simulation : la session est considérée payée.
      return {
        id,
        provider: 'simulation' as const,
        paid: true,
        status: 'complete',
        amountTotal: record?.amountCents ?? null,
        currency: record?.currency ?? null,
      };
    }

    const s = await this.stripe.checkout.sessions.retrieve(id);
    const paid = s.payment_status === 'paid';
    if (record) await this.applyStripeStatus(record, s);

    return {
      id: s.id,
      provider: 'stripe' as const,
      paid,
      status: s.status ?? 'open',
      amountTotal: s.amount_total,
      currency: s.currency,
    };
  }

  /**
   * Rattache après coup un règlement à l'envoi créé. Le client paie son devis
   * avant que le convoyage ou le colis n'existe : sans ce rattrapage, il
   * retrouverait une facture « à régler » pour une commande déjà payée.
   */
  async link(sessionId: string, user: AuthenticatedUser, dto: { missionId?: string; parcelId?: string }) {
    const record = await this.prisma.payment.findUnique({ where: { sessionId } });
    if (!record) throw new NotFoundException('Paiement introuvable.');
    if (record.clientId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Ce paiement ne vous appartient pas.');
    }
    const missionId = await this.ownedMissionId(record.clientId, dto.missionId);
    const parcelId = await this.ownedParcelId(record.clientId, dto.parcelId);
    if (!missionId && !parcelId) {
      throw new BadRequestException('Indiquez le convoyage ou le colis à rattacher.');
    }
    return this.prisma.payment.update({
      where: { id: record.id },
      // On ne réécrit pas un rattachement déjà posé.
      data: {
        missionId: record.missionId ?? missionId,
        parcelId: record.parcelId ?? parcelId,
      },
    });
  }

  /** Règlements du client connecté, ou tous pour l'administrateur. */
  async list(user: AuthenticatedUser, skip: number, take: number) {
    await this.reconcilePending(user.role === UserRole.ADMIN ? undefined : user.id);
    const where: Prisma.PaymentWhereInput =
      user.role === UserRole.ADMIN ? {} : { clientId: user.id };
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          mission: { select: { id: true, reference: true } },
          parcel: { select: { id: true, reference: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, total };
  }

  /** Chiffres d'encaissement pour le tableau de bord de l'administrateur. */
  async summary() {
    await this.reconcilePending();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthAgg, pendingAgg, allPaidAgg] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amountCents: true },
        _count: true,
        where: { status: PaymentStatus.PAID, paidAt: { gte: startOfMonth } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountCents: true },
        _count: true,
        where: { status: PaymentStatus.PENDING },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: { status: PaymentStatus.PAID },
      }),
    ]);

    return {
      collectedMonthCents: monthAgg._sum.amountCents ?? 0,
      collectedMonthCount: monthAgg._count,
      pendingCents: pendingAgg._sum.amountCents ?? 0,
      pendingCount: pendingAgg._count,
      collectedTotalCents: allPaidAgg._sum.amountCents ?? 0,
    };
  }

  /**
   * Rattrape les sessions restées PENDING : le client a pu payer puis fermer
   * la page sans que l'application repasse par /session/:id. On réinterroge
   * Stripe pour les sessions récentes uniquement.
   */
  private async reconcilePending(clientId?: string) {
    if (!this.stripe) return;
    const since = new Date(Date.now() - RECONCILE_WINDOW_DAYS * 86400000);
    const pending = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        provider: 'stripe',
        createdAt: { gte: since },
        ...(clientId ? { clientId } : {}),
      },
      take: RECONCILE_MAX,
      orderBy: { createdAt: 'desc' },
    });
    for (const p of pending) {
      try {
        const s = await this.stripe.checkout.sessions.retrieve(p.sessionId);
        await this.applyStripeStatus(p, s);
      } catch (e) {
        this.logger.warn(`Session ${p.sessionId} non relue : ${(e as Error).message}`);
      }
    }
  }

  private async applyStripeStatus(record: Payment, s: Stripe.Checkout.Session) {
    const status =
      s.payment_status === 'paid'
        ? PaymentStatus.PAID
        : s.status === 'expired'
          ? PaymentStatus.CANCELLED
          : PaymentStatus.PENDING;
    if (status === record.status) return;
    await this.prisma.payment.update({
      where: { id: record.id },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        amountCents: s.amount_total ?? record.amountCents,
      },
    });
    if (status === PaymentStatus.PAID) {
      await this.announcePaid({ ...record, amountCents: s.amount_total ?? record.amountCents });
    }
  }

  /** Prévient le client (reçu) et l'équipe Axis (encaissement à suivre). */
  private async announcePaid(record: Payment) {
    try {
      const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: record.currency }).format(
        record.amountCents / 100,
      );
      const what = record.reference ? ` — ${record.reference}` : '';
      const payload = { paymentId: record.id, missionId: record.missionId, parcelId: record.parcelId };
      await this.notifications.notify(
        record.clientId,
        'PAYMENT_RECEIVED',
        'Paiement confirmé',
        `Nous avons bien reçu ${amount}${what}. Merci !`,
        payload,
      );
      const client = await this.prisma.user.findUnique({
        where: { id: record.clientId },
        select: { firstName: true, lastName: true },
      });
      const admins = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, deletedAt: null },
        select: { id: true },
      });
      const who = client ? `${client.firstName} ${client.lastName}`.trim() : 'Un client';
      for (const a of admins) {
        await this.notifications.notify(a.id, 'PAYMENT_RECEIVED', 'Paiement reçu', `${who} a réglé ${amount}${what}.`, payload);
      }
    } catch (e) {
      this.logger.warn(`Notification de paiement non envoyée : ${(e as Error).message}`);
    }
  }

  private async ownedMissionId(clientId: string, missionId?: string): Promise<string | null> {
    if (!missionId) return null;
    const m = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: { clientId: true },
    });
    if (!m) throw new NotFoundException('Convoyage introuvable.');
    if (m.clientId !== clientId) throw new ForbiddenException('Ce convoyage ne vous appartient pas.');
    return missionId;
  }

  private async ownedParcelId(clientId: string, parcelId?: string): Promise<string | null> {
    if (!parcelId) return null;
    const p = await this.prisma.parcel.findUnique({
      where: { id: parcelId },
      select: { senderId: true },
    });
    if (!p) throw new NotFoundException('Colis introuvable.');
    if (p.senderId !== clientId) throw new ForbiddenException('Ce colis ne vous appartient pas.');
    return parcelId;
  }
}
