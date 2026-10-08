import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import Stripe from 'stripe';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { mailLayout, MailService, escapeHtml } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateCheckoutInput {
  /** Ignoré : le montant est celui de la commande, lu en base. */
  amountCents?: number;
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
/** Relecture automatique des paiements en attente, sans webhook à configurer. */
const RECONCILE_EVERY_MS = 2 * 60 * 1000;

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
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;
  private readonly defaultCurrency: string;
  private readonly allowSimulation: boolean;
  private readonly appUrl: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {
    this.appUrl = config.get<string>('appUrl', 'https://contactorixiom-ai.github.io/am/app/');
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

  // Un client qui paie puis ferme la page Stripe sans revenir dans
  // l'application : sa commande passe quand même « payée » (reçu, facture,
  // e-mail, alerte à Roger) dans les 2 minutes, sans webhook à configurer.
  onModuleInit() {
    if (!this.stripe || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.reconcilePending().catch((e) => this.logger.warn(`Relecture des paiements : ${(e as Error).message}`));
    }, RECONCILE_EVERY_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async createCheckoutSession(clientId: string, input: CreateCheckoutInput) {
    // On rattache le règlement à l'envoi, mais seulement s'il appartient bien
    // au client : un identifiant venu du téléphone ne fait pas foi.
    const missionId = await this.ownedMissionId(clientId, input.missionId);
    const parcelId = await this.ownedParcelId(clientId, input.parcelId);
    if (!missionId === !parcelId) {
      throw new BadRequestException('Indiquez la commande à régler.');
    }

    // Le montant est celui de la commande, lu en base. Il venait du
    // téléphone : un client pouvait régler 1 € une commande de 427 €.
    const shipment = missionId
      ? await this.prisma.mission.findUnique({
          where: { id: missionId },
          select: { priceCents: true, currency: true, status: true, reference: true, pickupCity: true, deliveryCity: true },
        })
      : await this.prisma.parcel.findUnique({
          where: { id: parcelId! },
          select: { priceCents: true, status: true, reference: true, originCity: true, destinationCity: true },
        });
    if (!shipment) throw new NotFoundException('Commande introuvable.');
    if (shipment.status === 'CANCELLED') throw new BadRequestException('Cette commande est annulée.');
    const amount = shipment.priceCents ?? 0;
    if (amount < 100) {
      throw new BadRequestException('Le prix de cette commande n\'est pas encore fixé : Axis vous le communique avant paiement.');
    }
    const currency = (('currency' in shipment && shipment.currency) || this.defaultCurrency).toLowerCase();
    const reference = shipment.reference;
    const route = 'pickupCity' in shipment
      ? `Convoyage ${shipment.pickupCity} → ${shipment.deliveryCity}`
      : `Envoi ${shipment.originCity} → ${shipment.destinationCity}`;
    const description = `${route} · ${reference}`;

    // Une seule fois : pas de second paiement d'une commande réglée, et une
    // page Stripe encore ouverte est reprise plutôt que doublée.
    const where = missionId ? { missionId } : { parcelId: parcelId! };
    const paid = await this.prisma.payment.findFirst({ where: { ...where, status: PaymentStatus.PAID } });
    if (paid) throw new BadRequestException('Cette commande est déjà réglée. Merci !');
    if (this.stripe) {
      const open = await this.prisma.payment.findFirst({
        where: { ...where, status: PaymentStatus.PENDING, provider: 'stripe', clientId, createdAt: { gte: new Date(Date.now() - 23 * 3600_000) } },
        orderBy: { createdAt: 'desc' },
      });
      if (open) {
        try {
          const s = await this.stripe.checkout.sessions.retrieve(open.sessionId);
          await this.applyStripeStatus(open, s);
          if (s.payment_status === 'paid') throw new BadRequestException('Cette commande est déjà réglée. Merci !');
          if (s.status === 'open' && s.url && s.amount_total === amount) {
            return { provider: 'stripe' as const, configured: true, id: s.id, url: s.url };
          }
        } catch (e) {
          if (e instanceof BadRequestException) throw e;
          this.logger.warn(`Session ${open.sessionId} non reprise : ${(e as Error).message}`);
        }
      }
    }

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
      const client = await this.prisma.user.findUnique({ where: { id: clientId }, select: { email: true } });
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        locale: 'fr',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amount,
              product_data: { name: description },
            },
          },
        ],
        // E-mail prérempli sur la page Stripe (et reçu Stripe s'il est activé).
        ...(client?.email ? { customer_email: client.email } : {}),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: reference,
        metadata: {
          reference,
          ...(missionId ? { missionId } : {}),
          ...(parcelId ? { parcelId } : {}),
        },
        payment_intent_data: { description, metadata: { reference } },
      });
      provider = 'stripe';
      id = session.id;
      url = session.url;
    }
    input = { ...input, reference, description };

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
      if (created.status === PaymentStatus.PAID) {
        await this.assignInvoiceNumber(created.id);
        await this.announcePaid(created);
      }
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
    // Mise à jour conditionnelle : le retour du client, la relecture
    // périodique et l'écran de Roger peuvent confirmer le même paiement au
    // même instant ; un seul d'entre eux envoie reçu, e-mail et alerte.
    const res = await this.prisma.payment.updateMany({
      where: { id: record.id, status: record.status },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        amountCents: s.amount_total ?? record.amountCents,
      },
    });
    if (res.count === 0) return;
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
    await this.sendPurchaseEmail(created.id);
    return { ...created, invoiceNumber };
  }

  /**
   * Remboursement fait par Roger (depuis Stripe pour un paiement en ligne,
   * ou en direct) après l'annulation d'une commande réglée. Le règlement
   * passe « remboursé » : il sort des encaissements et le client est prévenu.
   */
  async markRefunded(adminId: string, paymentId: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, clientId: true, amountCents: true, currency: true, reference: true },
    });
    if (!p) throw new NotFoundException('Règlement introuvable.');
    if (p.status !== PaymentStatus.PAID) throw new BadRequestException('Seul un règlement encaissé peut être remboursé.');
    const updated = await this.prisma.payment.update({
      where: { id: p.id },
      data: { status: PaymentStatus.REFUNDED, refundedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId: adminId, action: 'PAYMENT_REFUNDED', entity: 'Payment', entityId: p.id, metadata: { amountCents: p.amountCents } },
    });
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.currency || 'EUR' }).format(p.amountCents / 100);
    await this.notifications
      .notify(p.clientId, 'PAYMENT_RECEIVED', 'Remboursement effectué', `Axis t'a remboursé ${amount}${p.reference ? ` pour ${p.reference}` : ''}. Le délai d'apparition sur ton compte dépend de ta banque.`, { paymentId: p.id })
      .catch(() => undefined);
    return updated;
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
    await this.sendPurchaseEmail(record.id);
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

  /**
   * E-mail de confirmation et de remerciement envoyé au client dès que son
   * paiement est encaissé (en ligne ou saisi par Roger). Sans RESEND_API_KEY,
   * rien n'est envoyé : la notification dans l'application reste.
   */
  private async sendPurchaseEmail(paymentId: string) {
    if (!this.mail.enabled) return;
    try {
      const p = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          client: { select: { email: true, firstName: true, companyName: true } },
          mission: { select: { reference: true, pickupCity: true, deliveryCity: true, vehicle: { select: { make: true, model: true } } } },
          parcel: { select: { reference: true, originCity: true, destinationCity: true, weightKg: true } },
        },
      });
      if (!p?.client?.email) return;
      const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.currency || 'EUR' }).format(p.amountCents / 100);
      const reference = p.mission?.reference ?? p.parcel?.reference ?? p.reference ?? '';
      const what = p.mission
        ? `Convoyage ${p.mission.pickupCity} → ${p.mission.deliveryCity}`
        : p.parcel
          ? `Envoi ${p.parcel.originCity} → ${p.parcel.destinationCity}`
          : (p.description ?? 'Commande Axis Import');
      const method = p.provider === 'stripe' ? 'Paiement en ligne'
        : p.provider.startsWith('manual:') ? (p.description?.split(' (')[0].split(' — ')[0] ?? 'Règlement reçu par Axis')
        : 'Paiement';
      const rows: Array<[string, string]> = [
        ['Commande', reference],
        ['Prestation', what],
        ...(p.mission?.vehicle ? [['Véhicule', `${p.mission.vehicle.make} ${p.mission.vehicle.model}`] as [string, string]] : []),
        ...(p.parcel?.weightKg ? [['Poids déclaré', `${p.parcel.weightKg} kg`] as [string, string]] : []),
        ['Montant réglé', amount],
        ['Mode de règlement', method],
        ...(p.invoiceNumber ? [['Facture', p.invoiceNumber] as [string, string]] : []),
      ];
      const next = p.mission
        ? 'Axis vous confirme le créneau d\'enlèvement et le convoyeur affecté. Pendant le trajet, vous suivez le véhicule en direct dans l\'application ; l\'état des lieux et le contrat signés y sont disponibles.'
        : 'Axis vous tient informé de chaque étape de l\'envoi dans l\'application, jusqu\'à la remise au destinataire.';
      const help = this.mail.replyTo
        ? 'Une question ? Répondez simplement à cet e-mail, ou écrivez-nous depuis l\'application (Profil › Contacter Axis).'
        : 'Une question ? Écrivez-nous depuis l\'application (Profil › Contacter Axis).';
      await this.mail.send({
        to: p.client.email,
        subject: `Merci pour votre commande ${reference} — paiement confirmé`,
        text:
          `Bonjour ${p.client.firstName},\n\n` +
          `Merci pour votre confiance ! Nous avons bien reçu votre paiement de ${amount} pour ${what} (${reference}).\n` +
          (p.invoiceNumber ? `Votre facture ${p.invoiceNumber} est disponible dans l'application, onglet Documents.\n` : '') +
          `\n${next}\n\nSuivre ma commande : ${this.appUrl}\n\n${help}\n\nL'équipe Axis Import`,
        html: mailLayout({
          title: `Merci ${p.client.firstName} !`,
          paragraphs: [
            `Nous avons bien reçu votre paiement : votre commande est <strong>confirmée</strong> et l'équipe Axis Import s'en occupe.`,
          ],
          rows,
          cta: { label: 'Suivre ma commande', url: this.appUrl },
          footer:
            `${escapeHtml(next)}<br><br>` +
            (p.invoiceNumber ? 'Votre facture est disponible dans l\'application, onglet Documents.<br><br>' : '') +
            `${escapeHtml(help)}<br><br>Merci de votre confiance,<br>L'équipe Axis Import`,
        }),
      });
    } catch (e) {
      this.logger.warn(`E-mail de confirmation non envoyé (${paymentId}) : ${(e as Error).message}`);
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
