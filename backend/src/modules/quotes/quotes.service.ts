import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuoteStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { lookupCity } from '../../common/geocoding';
import { roadDistanceKm } from '../../common/road-distance';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { computeQuote } from './pricing';
import { publicTariffSheet } from './tariffs';

const QUOTE_VALIDITY_DAYS = 30;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  // Estimation en direct : même moteur de prix que create(), mais sans rien
  // écrire en base. Le client la voit se mettre à jour pendant qu'il remplit
  // le formulaire ; créer un devis à chaque frappe polluerait la table.
  async estimate(dto: CreateQuoteDto, user?: AuthenticatedUser) {
    const { distanceKm, computed } = await this.price(dto, user);
    return {
      transportMode: computed.transportMode,
      pickupMode: computed.pickupMode,
      distanceKm,
      subtotalCents: computed.subtotalCents,
      taxCents: computed.taxCents,
      totalCents: computed.totalCents,
      currency: computed.currency,
      uncertaintyPct: computed.uncertaintyPct,
      basePriceCents: computed.basePriceCents,
      variablePriceCents: computed.variablePriceCents,
      pickupFeeCents: computed.pickupFeeCents,
      addonsPriceCents: computed.addonsPriceCents,
      options: computed.options,
      lines: computed.lines,
      disclaimer: computed.disclaimer,
      hints: computed.hints,
    };
  }

  /** Grille tarifaire publique (écran « Nos tarifs » de l'app). */
  tariffs() {
    return publicTariffSheet();
  }

  // Géocodage, distance et tarification — la partie commune au devis
  // persisté et à l'estimation volatile.
  private async price(dto: CreateQuoteDto, user?: AuthenticatedUser) {
    const fromGeo = (dto.fromLatitude != null && dto.fromLongitude != null)
      ? { latitude: dto.fromLatitude, longitude: dto.fromLongitude }
      : lookupCity(dto.fromCity);
    const toGeo = (dto.toLatitude != null && dto.toLongitude != null)
      ? { latitude: dto.toLatitude, longitude: dto.toLongitude }
      : lookupCity(dto.toCity);

    // La distance fait le prix : elle est calculée ici, jamais reprise de la
    // requête (un « distanceKm: 1 » donnait un convoyage Paris → Lyon au
    // forfait minimum). Seul Roger peut l'imposer, pour un trajet atypique.
    const isAdmin = user?.role === UserRole.ADMIN;
    let distanceKm: number | undefined = isAdmin ? dto.distanceKm : undefined;
    if (distanceKm == null && fromGeo && toGeo) {
      distanceKm = await roadDistanceKm(fromGeo, toGeo);
    }

    try {
      const computed = computeQuote({
        service: dto.service,
        transportMode: dto.transportMode,
        pickupMode: dto.pickupMode,
        distanceKm,
        weightKg: dto.weightKg,
        volumeM3: dto.volumeM3,
        units: dto.units,
        options: dto.options ?? [],
        vehicleCategory: dto.vehicleCategory,
        pickupDistanceKm: dto.pickupDistanceKm,
        items: dto.items,
      });
      return { fromGeo, toGeo, distanceKm, computed };
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid quote input');
    }
  }

  async create(dto: CreateQuoteDto, user?: AuthenticatedUser) {
    const { fromGeo, toGeo, distanceKm, computed } = await this.price(dto, user);

    const expiresAt = new Date(Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    const created = await this.prisma.quote.create({
      data: {
        reference: this.generateReference(),
        customerId: user?.id,
        service: dto.service,
        transportMode: computed.transportMode,
        pickupMode: computed.pickupMode,
        status: user ? QuoteStatus.SAVED : QuoteStatus.DRAFT,
        fromCity: dto.fromCity,
        fromCountry: dto.fromCountry.toUpperCase(),
        fromLatitude: fromGeo?.latitude ?? dto.fromLatitude,
        fromLongitude: fromGeo?.longitude ?? dto.fromLongitude,
        toCity: dto.toCity,
        toCountry: dto.toCountry.toUpperCase(),
        toLatitude: toGeo?.latitude ?? dto.toLatitude,
        toLongitude: toGeo?.longitude ?? dto.toLongitude,
        distanceKm,
        weightKg: dto.weightKg,
        volumeM3: computed.volumeM3 ?? dto.volumeM3,
        units: dto.units,
        // Lignes TTC de la grille : le colis en reprend le contenu, l'app
        // les affiche telles quelles.
        lines: computed.lines.length > 0 ? (computed.lines as unknown as Prisma.InputJsonValue) : undefined,
        basePriceCents: computed.basePriceCents,
        variablePriceCents: computed.variablePriceCents,
        pickupFeeCents: computed.pickupFeeCents,
        addonsPriceCents: computed.addonsPriceCents,
        subtotalCents: computed.subtotalCents,
        taxRate: computed.taxRate,
        taxCents: computed.taxCents,
        totalCents: computed.totalCents,
        currency: computed.currency,
        uncertaintyPct: computed.uncertaintyPct,
        disclaimer: computed.disclaimer,
        expiresAt,
        options: {
          create: computed.options.map((o) => ({
            kind: o.kind,
            label: o.label,
            priceCents: o.priceCents,
            selected: true,
          })),
        },
      },
      include: { options: true },
    });

    // Attache les smart hints à la réponse (non stockés en DB)
    return { ...created, hints: computed.hints };
  }

  async listMine(userId: string, skip: number, take: number) {
    const where = { customerId: userId };
    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        skip,
        take,
        include: { options: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quote.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!quote) throw new NotFoundException('Devis introuvable.');
    // Quotes are accessible by their owner or by anyone who has the id (anonymous quotes).
    if (quote.customerId && user?.id !== quote.customerId && user?.role !== 'ADMIN') {
      throw new NotFoundException('Devis introuvable.');
    }
    return quote;
  }

  private generateReference(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `AXQ-${stamp}-${rand}`;
  }
}
