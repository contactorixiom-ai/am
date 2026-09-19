import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CargoTrackingStatus,
  CargoTrackingType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  COUNTRY_REGULATIONS,
  RequiredDocument,
  ShipmentKind,
  filterDocumentsForShipment,
  trackingTypeForCountry,
} from './customs.data';
import {
  CreateCountryRegulationDto,
  UpdateCountryRegulationDto,
} from './dto/country-regulation.dto';
import {
  CreateCargoNoteDto,
  UpdateCargoNoteStatusDto,
} from './dto/cargo-note.dto';

@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CountryRegulation CRUD ──────────────────────────────────────────────

  listRegulations() {
    return this.prisma.countryRegulation.findMany({
      orderBy: { countryName: 'asc' },
    });
  }

  async getRegulation(countryCode: string) {
    const reg = await this.prisma.countryRegulation.findUnique({
      where: { countryCode: countryCode.toUpperCase() },
    });
    if (!reg) throw new NotFoundException(`Aucune réglementation pour ${countryCode}`);
    return reg;
  }

  createRegulation(dto: CreateCountryRegulationDto) {
    return this.prisma.countryRegulation.create({
      data: {
        countryCode: dto.countryCode.toUpperCase(),
        countryName: dto.countryName,
        cargoTrackingType: dto.cargoTrackingType,
        cargoMandatory: dto.cargoMandatory ?? true,
        authority: dto.authority,
        currency: dto.currency ?? 'XOF',
        customsNotes: dto.customsNotes,
        requiredDocuments: dto.requiredDocuments as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateRegulation(countryCode: string, dto: UpdateCountryRegulationDto) {
    await this.getRegulation(countryCode);
    return this.prisma.countryRegulation.update({
      where: { countryCode: countryCode.toUpperCase() },
      data: {
        countryName: dto.countryName,
        cargoTrackingType: dto.cargoTrackingType,
        cargoMandatory: dto.cargoMandatory,
        authority: dto.authority,
        currency: dto.currency,
        customsNotes: dto.customsNotes,
        requiredDocuments: dto.requiredDocuments
          ? (dto.requiredDocuments as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async deleteRegulation(countryCode: string) {
    await this.getRegulation(countryCode);
    return this.prisma.countryRegulation.delete({
      where: { countryCode: countryCode.toUpperCase() },
    });
  }

  /**
   * Seed idempotent de la matrice réglementaire pilote.
   * Exposé en endpoint admin et réutilisable par prisma/seed.ts.
   */
  async seedRegulations(): Promise<{ seeded: number }> {
    for (const reg of COUNTRY_REGULATIONS) {
      await this.prisma.countryRegulation.upsert({
        where: { countryCode: reg.countryCode },
        update: {
          countryName: reg.countryName,
          cargoTrackingType: reg.cargoTrackingType,
          cargoMandatory: reg.cargoMandatory,
          authority: reg.authority,
          currency: reg.currency,
          customsNotes: reg.customsNotes,
          requiredDocuments: reg.requiredDocuments as unknown as Prisma.InputJsonValue,
        },
        create: {
          countryCode: reg.countryCode,
          countryName: reg.countryName,
          cargoTrackingType: reg.cargoTrackingType,
          cargoMandatory: reg.cargoMandatory,
          authority: reg.authority,
          currency: reg.currency,
          customsNotes: reg.customsNotes,
          requiredDocuments: reg.requiredDocuments as unknown as Prisma.InputJsonValue,
        },
      });
    }
    this.logger.log(`Seeded ${COUNTRY_REGULATIONS.length} country regulations`);
    return { seeded: COUNTRY_REGULATIONS.length };
  }

  // ─── Requirements (réglementation + checklist) ───────────────────────────

  /**
   * Renvoie la réglementation d'un pays + la checklist de documents requis.
   * Si un parcelId est fourni, calcule l'état "fourni / manquant" de chaque
   * document à partir des documents douaniers déjà rattachés au colis.
   */
  async getRequirements(countryCode: string, parcelId?: string, kind?: ShipmentKind) {
    const reg = await this.getRegulation(countryCode);
    const allDocs = (reg.requiredDocuments as unknown as RequiredDocument[]) ?? [];
    // Filtrage par type d'envoi : un colis ne demande pas les docs véhicule.
    const requiredDocuments = kind ? filterDocumentsForShipment(allDocs, kind) : allDocs;

    let cargoNote = null;
    let checklist: RequiredDocument[] = requiredDocuments;

    if (parcelId) {
      cargoNote = await this.prisma.cargoTrackingNote.findFirst({
        where: { parcelId, destinationCountry: reg.countryCode },
        orderBy: { createdAt: 'desc' },
      });

      // Documents douaniers déjà rattachés au colis → état "fourni".
      const docs = await this.prisma.document.findMany({
        where: { parcelId, category: 'CUSTOMS' },
        select: { title: true },
      });
      const haveCargoNote =
        cargoNote != null &&
        (cargoNote.status === CargoTrackingStatus.VALIDATED ||
          cargoNote.status === CargoTrackingStatus.ISSUED);

      checklist = requiredDocuments.map((d) => ({
        ...d,
        provided:
          d.key === 'cargo_tracking_note'
            ? haveCargoNote
            : docs.some((doc) => this.matchesDocument(doc.title, d)),
      }));
    }

    return {
      countryCode: reg.countryCode,
      countryName: reg.countryName,
      cargoTrackingType: reg.cargoTrackingType,
      cargoMandatory: reg.cargoMandatory,
      authority: reg.authority,
      currency: reg.currency,
      customsNotes: reg.customsNotes,
      checklist,
      cargoNote,
    };
  }

  // Heuristique simple : un document est "fourni" si son titre contient le
  // libellé attendu ou la clé. Suffisant pour le pilote.
  private matchesDocument(title: string, doc: RequiredDocument): boolean {
    const t = title.toLowerCase();
    return t.includes(doc.label.toLowerCase()) || t.includes(doc.key.replace(/_/g, ' '));
  }

  // ─── CargoTrackingNote ───────────────────────────────────────────────────

  async createCargoNote(dto: CreateCargoNoteDto) {
    const destinationCountry = dto.destinationCountry.toUpperCase();

    // Type requis : explicite, sinon déduit du pays, sinon générique.
    const type =
      dto.type ??
      trackingTypeForCountry(destinationCountry) ??
      CargoTrackingType.CARGO_WAIVER;

    if (dto.parcelId) {
      const parcel = await this.prisma.parcel.findUnique({
        where: { id: dto.parcelId },
        select: { id: true },
      });
      if (!parcel) throw new BadRequestException('Colis introuvable');
    }

    const regulation = await this.prisma.countryRegulation.findUnique({
      where: { countryCode: destinationCountry },
      select: { id: true, cargoMandatory: true },
    });

    const initialStatus = regulation && regulation.cargoMandatory === false
      ? CargoTrackingStatus.NOT_REQUIRED
      : CargoTrackingStatus.TO_REQUEST;

    return this.prisma.cargoTrackingNote.create({
      data: {
        parcelId: dto.parcelId,
        regulationId: regulation?.id,
        type,
        status: initialStatus,
        destinationCountry,
        blNumber: dto.blNumber,
        hsCode: dto.hsCode,
        fobValueCents: dto.fobValueCents,
      },
    });
  }

  listCargoNotes(parcelId?: string) {
    const where: Prisma.CargoTrackingNoteWhereInput = {};
    if (parcelId) where.parcelId = parcelId;
    return this.prisma.cargoTrackingNote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { regulation: true },
    });
  }

  async updateCargoNoteStatus(id: string, dto: UpdateCargoNoteStatusDto) {
    const note = await this.prisma.cargoTrackingNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Bordereau introuvable');

    const data: Prisma.CargoTrackingNoteUpdateInput = { status: dto.status };
    if (dto.number !== undefined) data.number = dto.number;
    if (dto.feeCents !== undefined) data.feeCents = dto.feeCents;
    if (dto.status === CargoTrackingStatus.VALIDATED) data.validatedAt = new Date();
    if (dto.status === CargoTrackingStatus.ISSUED) data.issuedAt = new Date();

    return this.prisma.cargoTrackingNote.update({ where: { id }, data });
  }
}
