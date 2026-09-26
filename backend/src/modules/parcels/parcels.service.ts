import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, ParcelStatus, PickupMode, Prisma, UserRole } from '@prisma/client';
import { lookupCity } from '../../common/geocoding';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { AddParcelEventDto } from './dto/parcel-event.dto';

// Délais de bout en bout annoncés au client au moment du devis. On retient la
// borne haute : mieux vaut livrer en avance qu'annoncer une date qu'on rate.
const TRANSIT_DAYS: Record<string, number> = {
  AIR: 10,
  SEA: 45,
};

// Jours restants une fois le colis engagé : à partir de ces étapes, la date
// d'arrivée ne dépend plus du mode de transport mais de l'avancement réel.
const REMAINING_DAYS: Partial<Record<ParcelStatus, number>> = {
  CUSTOMS: 5,
  OUT_FOR_DELIVERY: 1,
};

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

// Titres lisibles par l'expéditeur, alignés sur le pipeline de l'espace admin.
const PARCEL_STATUS_LABEL: Partial<Record<ParcelStatus, string>> = {
  AWAITING_DROP_OFF: 'En attente de dépôt',
  AWAITING_PICKUP: 'Enlèvement programmé',
  RECEIVED: 'Colis réceptionné',
  IN_TRANSIT: 'Colis en transit',
  CUSTOMS: 'En cours de dédouanement',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Colis livré',
  CANCELLED: 'Envoi annulé',
  LOST: 'Colis en recherche',
};

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Coordonnées des villes, pour tracer le trajet sur une vraie carte côté
  // client. Résolues à la lecture depuis l'annuaire interne : pas de colonne
  // à maintenir, et une ville inconnue renvoie simplement null.
  private withCoords<T extends { originCity: string; destinationCity: string }>(parcel: T) {
    const from = lookupCity(parcel.originCity);
    const to = lookupCity(parcel.destinationCity);
    return {
      ...parcel,
      originLatitude: from?.latitude ?? null,
      originLongitude: from?.longitude ?? null,
      destinationLatitude: to?.latitude ?? null,
      destinationLongitude: to?.longitude ?? null,
    };
  }

  async create(senderId: string, dto: CreateParcelDto) {
    const pickupMode = dto.pickupMode ?? PickupMode.HUB_DROP_OFF;

    // Validation cohérence first-mile
    if (pickupMode === PickupMode.RELAY_DROP_OFF && !dto.relayPointId) {
      throw new BadRequestException('relayPointId requis pour un dépôt en point relais');
    }
    if (pickupMode === PickupMode.HOME_PICKUP && !dto.pickupAddress) {
      throw new BadRequestException('pickupAddress requis pour un enlèvement à domicile');
    }
    if (dto.relayPointId) {
      const relay = await this.prisma.relayPoint.findUnique({ where: { id: dto.relayPointId } });
      if (!relay) throw new BadRequestException('Point relais introuvable');
    }

    // Prix du devis accepté, lu côté serveur : le colis était enregistré sans
    // prix, et Roger ne voyait pas le montant de la commande.
    let priceCents: number | undefined;
    if (dto.quoteId) {
      const quote = await this.prisma.quote.findUnique({ where: { id: dto.quoteId } });
      if (!quote) throw new NotFoundException('Devis introuvable.');
      if (quote.service !== 'PARCEL' && quote.service !== 'MERCHANDISE') {
        throw new BadRequestException('Ce devis ne concerne pas un envoi de colis.');
      }
      if (quote.customerId && quote.customerId !== senderId) {
        throw new ForbiddenException('Ce devis ne vous appartient pas.');
      }
      if (quote.status === 'CONVERTED') throw new BadRequestException('Ce devis a déjà donné lieu à une commande.');
      if (quote.expiresAt < new Date()) {
        throw new BadRequestException('Ce devis a expiré. Refais une estimation pour obtenir le tarif du jour.');
      }
      priceCents = quote.totalCents;
      await this.prisma.quote.update({ where: { id: quote.id }, data: { status: 'CONVERTED', customerId: senderId } });
    }

    // Statut initial selon le mode
    const initialStatus = pickupMode === PickupMode.HOME_PICKUP
      ? ParcelStatus.AWAITING_PICKUP
      : ParcelStatus.AWAITING_DROP_OFF;

    // Date d'arrivée prévue : le client attend plusieurs semaines pour un
    // envoi maritime, il lui faut une date dès la commande.
    const transitDays = TRANSIT_DAYS[dto.transportMode ?? 'AIR'] ?? TRANSIT_DAYS.AIR;
    const estimatedDelivery = addDays(new Date(), transitDays);

    const parcel = await this.prisma.parcel.create({
      data: {
        senderId,
        priceCents,
        estimatedDelivery,
        reference: this.generateReference(),
        status: initialStatus,
        category: dto.category,
        transportMode: dto.transportMode,
        pickupMode,
        weightKg: dto.weightKg,
        declaredValueCents: dto.declaredValueCents,
        description: dto.description,
        recipientFirstName: dto.recipientFirstName,
        recipientLastName: dto.recipientLastName,
        recipientPhone: dto.recipientPhone,
        recipientEmail: dto.recipientEmail,
        originCountry: dto.originCountry.toUpperCase(),
        originCity: dto.originCity,
        originAddress: dto.originAddress,
        destinationCountry: dto.destinationCountry.toUpperCase(),
        destinationCity: dto.destinationCity,
        destinationAddress: dto.destinationAddress,
        relayPointId: dto.relayPointId,
        pickupAddress: dto.pickupAddress,
        pickupAt: dto.pickupAt ? new Date(dto.pickupAt) : null,
        trackingEvents: {
          create: {
            status: initialStatus,
            notes: pickupMode === PickupMode.HOME_PICKUP
              ? 'En attente d\'enlèvement à domicile'
              : pickupMode === PickupMode.RELAY_DROP_OFF
                ? 'En attente de dépôt au point relais'
                : 'En attente de dépôt chez Axis',
          },
        },
        items: dto.items
          ? {
              create: dto.items.map((i) => ({
                description: i.description,
                quantity: i.quantity ?? 1,
                weightKg: i.weightKg,
                valueCents: i.valueCents,
                hsCode: i.hsCode,
              })),
            }
          : undefined,
      },
      include: { items: true, relayPoint: true, trackingEvents: true },
    });

    // Roger doit savoir qu'un envoi vient d'être commandé.
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });
    const price = priceCents != null
      ? ` · ${(priceCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`
      : '';
    for (const a of admins) {
      await this.notifications
        .notify(a.id, NotificationType.PARCEL_STATUS_UPDATE, 'Nouvel envoi de colis',
          `${parcel.reference} — ${parcel.originCity} → ${parcel.destinationCity}${price}.`, { parcelId: parcel.id })
        .catch(() => undefined);
    }
    return parcel;
  }

  async list(user: AuthenticatedUser, opts: { skip: number; take: number; status?: ParcelStatus }) {
    const where: Prisma.ParcelWhereInput =
      user.role === UserRole.ADMIN ? {} : { senderId: user.id };
    if (opts.status) where.status = opts.status;

    const [data, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        // Le dernier événement suffit à savoir depuis quand un colis n'a pas
        // bougé : c'est ce qui alimente les relances de l'espace admin.
        include: { items: true, trackingEvents: { orderBy: { occurredAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parcel.count({ where }),
    ]);
    return { data: data.map((p) => this.withCoords(p)), total };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id },
      include: { items: true, trackingEvents: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!parcel) throw new NotFoundException('Colis introuvable.');
    if (user.role !== UserRole.ADMIN && parcel.senderId !== user.id) {
      throw new ForbiddenException();
    }
    return this.withCoords(parcel);
  }

  async track(reference: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { reference },
      select: {
        reference: true,
        status: true,
        originCountry: true,
        originCity: true,
        destinationCountry: true,
        destinationCity: true,
        weightKg: true,
        transportMode: true,
        estimatedDelivery: true,
        partnerCarrier: true,
        partnerTracking: true,
        deliveredAt: true,
        trackingEvents: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!parcel) throw new NotFoundException('Colis introuvable.');
    return this.withCoords(parcel);
  }

  async addEvent(id: string, dto: AddParcelEventDto, user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Réservé à l\'administrateur.');
    const parcel = await this.prisma.parcel.findUnique({ where: { id } });
    if (!parcel) throw new NotFoundException('Colis introuvable.');

    await this.prisma.parcelTrackingEvent.create({
      data: {
        parcelId: id,
        status: dto.status,
        location: dto.location,
        notes: dto.notes,
      },
    });
    // Date d'arrivée : Roger peut la corriger, sinon on la resserre à partir
    // des étapes où elle ne dépend plus du mode de transport.
    let estimatedDelivery: Date | undefined;
    if (dto.estimatedDelivery) {
      estimatedDelivery = new Date(dto.estimatedDelivery);
    } else {
      const remaining = REMAINING_DAYS[dto.status];
      if (remaining != null) estimatedDelivery = addDays(new Date(), remaining);
    }

    const updated = await this.prisma.parcel.update({
      where: { id },
      data: {
        status: dto.status,
        estimatedDelivery,
        // Suivi partenaire : renseigné seulement quand Roger le reçoit du
        // transporteur. Jamais inventé — le client le copierait sur leur site.
        partnerCarrier: dto.partnerCarrier?.trim() || undefined,
        partnerTracking: dto.partnerTracking?.trim() || undefined,
        deliveredAt: dto.status === ParcelStatus.DELIVERED ? new Date() : undefined,
      },
    });

    // L'expéditeur suit son colis depuis l'app : chaque étape le prévient.
    // Un échec d'envoi ne doit pas annuler la mise à jour du statut.
    try {
      await this.notifications.notify(
        updated.senderId,
        NotificationType.PARCEL_STATUS_UPDATE,
        PARCEL_STATUS_LABEL[dto.status] ?? 'Suivi mis à jour',
        [
          `Colis ${updated.reference}`,
          dto.location,
          dto.notes,
          dto.status !== ParcelStatus.DELIVERED && updated.estimatedDelivery
            ? `Arrivée prévue le ${updated.estimatedDelivery.toLocaleDateString('fr-FR')}`
            : undefined,
        ].filter(Boolean).join(' · '),
        { parcelId: id, reference: updated.reference, status: dto.status },
      );
    } catch {
      /* journalisé côté service */
    }
    return updated;
  }

  private generateReference(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AXP-${stamp}-${rand}`;
  }
}
