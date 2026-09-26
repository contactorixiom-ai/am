import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  private readonly allowSimulation: boolean;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    const key = config.get<string>('stripe.secretKey');
    this.defaultCurrency = config.get<string>('stripe.currency', 'eur');
    this.allowSimulation = config.get<boolean>('stripe.allowSimulation', false);
    this.stripe = key ? new Stripe(key) : null;
    if (!this.stripe) {
      this.logger.warn(
        this.allowSimulation
          ? 'STRIPE_SECRET_KEY absent — paiements en mode SIMULATION (aucun débit réel).'
          : 'STRIPE_SECRET_KEY absent — paiement en ligne désactivé.',
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

    if (!this.stripe && !this.allowSimulation) {
      throw new ServiceUnavailableException(
        'Le paiement en ligne n\'est pas encore activé. Contactez Axis Import pour régler votre commande.',
      );
    }
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
      const created = await this.prisma.payment.create({
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
      if (created.status === PaymentStatus.PAID) await this.assignInvoiceNumber(created.id);
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

    // « À encaisser » = commandes chiffrées, non annulées, sans règlement
    // payé. Il ne comptait que les paiements en ligne en cours (0 € affiché
    // alors que des commandes restaient dues).
    const noPaid = { payments: { none: { status: PaymentStatus.PAID } } };
    const [dueMissions, dueParcels] = await Promise.all([
      this.prisma.mission.aggregate({
        _sum: { priceCents: true },
        _count: true,
        where: { priceCents: { gt: 0 }, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...noPaid },
      }),
      this.prisma.parcel.aggregate({
        _sum: { priceCents: true },
        _count: true,
        where: { priceCents: { gt: 0 }, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...noPaid },
      }),
    ]);
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
      pendingCents: (dueMissions._sum.priceCents ?? 0) + (dueParcels._sum.priceCents ?? 0),
      pendingCount: dueMissions._count + dueParcels._count,
      checkoutPendingCents: pendingAgg._sum.amountCents ?? 0,
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
      await this.assignInvoiceNumber(record.id);
      await this.announcePaid({ ...record, amountCents: s.amount_total ?? record.amountCents });
    }
  }

  /**
   * Règlement reçu hors de l'application (virement, espèces, chèque, TPE,
   * mobile money) : Roger l'enregistre, la commande passe « payée » et reçoit
   * son numéro de facture légal.
   */
  async recordManual(adminId: string, dto: { missionId?: string; parcelId?: string; amountCents: number; method: string; note?: string }) {
    if (!!dto.missionId === !!dto.parcelId) {
      throw new BadRequestException('Indiquez une mission ou un colis.');
    }
    const shipment = dto.missionId
      ? await this.prisma.mission.findUnique({ where: { id: dto.missionId }, select: { clientId: true, reference: true, pickupCity: true, deliveryCity: true } })
      : await this.prisma.parcel.findUnique({ where: { id: dto.parcelId }, select: { senderId: true, reference: true, originCity: true, destinationCity: true } });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    const clientId = 'clientId' in shipment ? shipment.clientId : shipment.senderId;
    const already = await this.prisma.payment.findFirst({
      where: { status: PaymentStatus.PAID, ...(dto.missionId ? { missionId: dto.missionId } : { parcelId: dto.parcelId }) },
      select: { invoiceNumber: true },
    });
    if (already) throw new BadRequestException(`Déjà réglé (facture ${already.invoiceNumber ?? 'en cours'}).`);

    const METHOD: Record<string, string> = {
      TRANSFER: 'Virement', CASH: 'Espèces', CHECK: 'Chèque', CARD_TERMINAL: 'Carte (TPE)', MOBILE_MONEY: 'Mobile money',
    };
    const created = await this.prisma.payment.create({
      data: {
        clientId,
        missionId: dto.missionId,
        parcelId: dto.parcelId,
        sessionId: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        provider: `manual:${dto.method.toLowerCase()}`,
        reference: shipment.reference,
        description: `${METHOD[dto.method] ?? dto.method}${dto.note ? ` — ${dto.note}` : ''} (saisi par Axis)`,
        amountCents: dto.amountCents,
        currency: 'EUR',
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: adminId, action: 'PAYMENT_MANUAL', entity: 'Payment', entityId: created.id, metadata: { method: dto.method, amountCents: dto.amountCents } },
    });
    const invoiceNumber = await this.assignInvoiceNumber(created.id);
    await this.notifications
      .notify(clientId, 'PAYMENT_RECEIVED', 'Paiement enregistré',
        `Axis a bien reçu ${(dto.amountCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} pour ${shipment.reference}. Ta facture est disponible dans Documents.`,
        { paymentId: created.id })
      .catch(() => undefined);
    return { ...created, invoiceNumber };
  }

  /**
   * Numéro de facture à l'encaissement : FA-<année>-<n° sur 6 chiffres>,
   * sans trou ni doublon. Le compteur est incrémenté dans la même transaction
   * que l'écriture du numéro ; un paiement déjà numéroté ne l'est pas deux fois.
   */
  private async assignInvoiceNumber(paymentId: string): Promise<string | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.payment.findUnique({ where: { id: paymentId }, select: { invoiceNumber: true, paidAt: true } });
        if (!current || current.invoiceNumber) return current?.invoiceNumber ?? null;
        const year = (current.paidAt ?? new Date()).getFullYear();
        const seq = await tx.invoiceSequence.upsert({
          where: { year },
          create: { year, last: 1 },
          update: { last: { increment: 1 } },
        });
        const number = `FA-${year}-${String(seq.last).padStart(6, '0')}`;
        await tx.payment.update({ where: { id: paymentId }, data: { invoiceNumber: number } });
        return number;
      });
    } catch (e) {
      this.logger.error(`Numéro de facture non attribué (${paymentId}) : ${(e as Error).message}`);
      return null;
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
