import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { lookupCity } from '../../common/geocoding';
import { haversineKm, roadKmFromHaversine } from '../../common/haversine';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { computeQuote } from './pricing';

const QUOTE_VALIDITY_DAYS = 30;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuoteDto, user?: AuthenticatedUser) {
    // Auto-géocodage des villes si lat/lng absents
    const fromGeo = (dto.fromLatitude != null && dto.fromLongitude != null)
      ? { latitude: dto.fromLatitude, longitude: dto.fromLongitude }
      : lookupCity(dto.fromCity);
    const toGeo = (dto.toLatitude != null && dto.toLongitude != null)
      ? { latitude: dto.toLatitude, longitude: dto.toLongitude }
      : lookupCity(dto.toCity);

    // Auto-calcul distance routière si non fournie
    let distanceKm = dto.distanceKm;
    if (distanceKm == null && fromGeo && toGeo) {
      distanceKm = roadKmFromHaversine(haversineKm(fromGeo, toGeo));
    }

    let computed;
    try {
      computed = computeQuote({
        service: dto.service,
        transportMode: dto.transportMode,
        distanceKm,
        weightKg: dto.weightKg,
        volumeM3: dto.volumeM3,
        units: dto.units,
        options: dto.options ?? [],
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid quote input');
    }

    const expiresAt = new Date(Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    return this.prisma.quote.create({
      data: {
        reference: this.generateReference(),
        customerId: user?.id,
        service: dto.service,
        transportMode: computed.transportMode,
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
        volumeM3: dto.volumeM3,
        units: dto.units,
        basePriceCents: computed.basePriceCents,
        variablePriceCents: computed.variablePriceCents,
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
    if (!quote) throw new NotFoundException('Quote not found');
    // Quotes are accessible by their owner or by anyone who has the id (anonymous quotes).
    if (quote.customerId && user?.id !== quote.customerId && user?.role !== 'ADMIN') {
      throw new NotFoundException('Quote not found');
    }
    return quote;
  }

  private generateReference(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `AXQ-${stamp}-${rand}`;
  }
}
