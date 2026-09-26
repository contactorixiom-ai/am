import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentCategory, DocumentVisibility, MissionStatus, Prisma, UserRole } from '@prisma/client';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AdminCreateMissionDto } from './dto/admin-create-mission.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { SearchMissionsDto } from './dto/search-missions.dto';
import { SignContractDto } from './dto/sign-contract.dto';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(clientId: string, dto: CreateMissionDto) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.deletedAt) throw new NotFoundException('Véhicule introuvable.');
    if (vehicle.ownerId !== clientId) {
      throw new ForbiddenException('Vous ne pouvez créer une mission que pour vos propres véhicules.');
    }

    // Commande passée depuis un devis : prix du devis, mission publiée.
    // Auparavant la mission restait en brouillon, sans prix, alors que le
    // client venait de payer et lisait « Ta mission est publiée ».
    let priceCents: number | undefined;
    let currency: string | undefined;
    let distanceKm: number | undefined;
    if (dto.quoteId) {
      const quote = await this.prisma.quote.findUnique({ where: { id: dto.quoteId } });
      if (!quote) throw new NotFoundException('Devis introuvable.');
      if (quote.service !== 'CONVOY_CAR' && quote.service !== 'CONVOY_MOTO') {
        throw new BadRequestException('Ce devis ne concerne pas un convoyage.');
      }
      if (quote.customerId && quote.customerId !== clientId) {
        throw new ForbiddenException('Ce devis ne vous appartient pas.');
      }
      if (quote.status === 'CONVERTED') throw new BadRequestException('Ce devis a déjà donné lieu à une commande.');
      if (quote.expiresAt < new Date()) {
        throw new BadRequestException('Ce devis a expiré. Refais une estimation pour obtenir le tarif du jour.');
      }
      priceCents = quote.totalCents;
      currency = quote.currency;
      distanceKm = quote.distanceKm ?? undefined;
      await this.prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'CONVERTED', customerId: clientId },
      });
    }
    const status = dto.quoteId ? MissionStatus.PUBLISHED : MissionStatus.DRAFT;

    const mission = await this.prisma.mission.create({
      data: {
        clientId,
        vehicleId: dto.vehicleId,
        reference: this.generateReference(),
        status,
        priceCents,
        distanceKm,
        ...(currency ? { currency } : {}),
        priority: dto.priority,
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupCountry: dto.pickupCountry.toUpperCase(),
        pickupPostalCode: dto.pickupPostalCode,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        pickupAt: new Date(dto.pickupAt),
        pickupNotes: dto.pickupNotes,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryCountry: dto.deliveryCountry.toUpperCase(),
        deliveryPostalCode: dto.deliveryPostalCode,
        deliveryLatitude: dto.deliveryLatitude,
        deliveryLongitude: dto.deliveryLongitude,
        deliveryAt: dto.deliveryAt ? new Date(dto.deliveryAt) : null,
        deliveryNotes: dto.deliveryNotes,
        statusHistory: {
          create: { status, changedBy: clientId },
        },
      },
      include: { vehicle: true },
    });

    if (status === MissionStatus.PUBLISHED) {
      // Roger doit savoir qu'une commande vient d'arriver.
      const admins = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, deletedAt: null },
        select: { id: true },
      });
      const price = priceCents != null ? ` · ${(priceCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: currency ?? 'EUR' })}` : '';
      for (const a of admins) {
        await this.notifySafe(
          a.id,
          NotificationType.MISSION_CREATED,
          'Nouvelle commande de convoyage',
          `${mission.reference} — ${mission.pickupCity} → ${mission.deliveryCity}${price}. Un convoyeur est à affecter.`,
          { missionId: mission.id },
        );
      }
    }
    return mission;
  }

  // Prise de commande par Roger (téléphone / e-mail) : il saisit la commande à la
  // place du client. Le client et le véhicule sont créés à la volée si besoin,
  // et le convoyeur peut être affecté dans la foulée.
  async adminCreate(adminId: string, dto: AdminCreateMissionDto) {
    const client = await this.resolveClient(dto);
    const vehicle = await this.resolveVehicle(client.id, dto);

    const hasDriver = Boolean(dto.driverId);
    const status = hasDriver ? MissionStatus.ACCEPTED : MissionStatus.DRAFT;

    if (dto.driverId) {
      const driver = await this.prisma.user.findUnique({ where: { id: dto.driverId } });
      if (!driver || driver.deletedAt) throw new NotFoundException('Convoyeur introuvable');
    }

    const mission = await this.prisma.mission.create({
      data: {
        clientId: client.id,
        vehicleId: vehicle.id,
        driverId: dto.driverId ?? null,
        reference: this.generateReference(),
        status,
        priority: dto.priority,
        acceptedAt: hasDriver ? new Date() : null,
        priceCents: dto.priceCents ?? null,
        distanceKm: dto.distanceKm ?? null,
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupCountry: (dto.pickupCountry ?? 'FR').toUpperCase(),
        pickupPostalCode: dto.pickupPostalCode,
        pickupLatitude: dto.pickupLatitude ?? 0,
        pickupLongitude: dto.pickupLongitude ?? 0,
        pickupAt: new Date(dto.pickupAt),
        pickupNotes: dto.pickupNotes,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryCountry: (dto.deliveryCountry ?? 'FR').toUpperCase(),
        deliveryPostalCode: dto.deliveryPostalCode,
        deliveryLatitude: dto.deliveryLatitude ?? 0,
        deliveryLongitude: dto.deliveryLongitude ?? 0,
        deliveryAt: dto.deliveryAt ? new Date(dto.deliveryAt) : null,
        deliveryNotes: dto.deliveryNotes,
        statusHistory: {
          create: { status, changedBy: adminId, notes: 'Commande saisie par l\'administrateur' },
        },
      },
      include: {
        vehicle: { select: { id: true, make: true, model: true, year: true, licensePlate: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (dto.driverId) {
      await this.ensureMissionConversation(mission.id, client.id, dto.driverId);
    }
    await this.notifySafe(
      client.id,
      NotificationType.MISSION_CREATED,
      'Commande enregistrée',
      `Ton convoyage ${mission.reference} (${mission.pickupCity} vers ${mission.deliveryCity}) est enregistré par Axis.`,
      { missionId: mission.id, reference: mission.reference },
    );
    return mission;
  }

  private async resolveClient(dto: AdminCreateMissionDto) {
    if (dto.clientId) {
      const existing = await this.prisma.user.findUnique({ where: { id: dto.clientId } });
      if (!existing || existing.deletedAt) throw new NotFoundException('Client introuvable');
      return existing;
    }

    const email = dto.clientEmail?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Indiquez un client existant ou son adresse e-mail');
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail && !byEmail.deletedAt) return byEmail;

    if (!dto.clientFirstName || !dto.clientLastName) {
      throw new BadRequestException('Nom et prénom requis pour créer le client');
    }

    // Mot de passe aléatoire : le client passera par « mot de passe oublié »
    // pour activer son accès au suivi.
    const passwordHash = await argon2.hash(randomBytes(24).toString('hex'), { type: argon2.argon2id });
    return this.prisma.user.create({
      data: {
        email,
        phone: dto.clientPhone?.trim() || null,
        passwordHash,
        role: UserRole.CLIENT,
        status: 'PENDING',
        firstName: dto.clientFirstName.trim(),
        lastName: dto.clientLastName.trim(),
      },
    });
  }

  private async resolveVehicle(clientId: string, dto: AdminCreateMissionDto) {
    if (dto.vehicleId) {
      const existing = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!existing || existing.deletedAt) throw new NotFoundException('Véhicule introuvable');
      return existing;
    }

    if (!dto.vehicleMake || !dto.vehicleModel || !dto.vehiclePlate) {
      throw new BadRequestException('Marque, modèle et immatriculation du véhicule requis');
    }

    const plate = dto.vehiclePlate.trim().toUpperCase();
    const known = await this.prisma.vehicle.findFirst({
      where: { ownerId: clientId, licensePlate: plate, deletedAt: null },
    });
    if (known) return known;

    return this.prisma.vehicle.create({
      data: {
        ownerId: clientId,
        type: dto.vehicleType,
        make: dto.vehicleMake.trim(),
        model: dto.vehicleModel.trim(),
        year: dto.vehicleYear ?? new Date().getFullYear(),
        licensePlate: plate,
        vin: dto.vehicleVin?.trim() || null,
      },
    });
  }

  async search(query: SearchMissionsDto, user: AuthenticatedUser) {
    const where: Prisma.MissionWhereInput = {};

    if (user.role === UserRole.CLIENT) {
      where.clientId = user.id;
    } else if (user.role === UserRole.DRIVER) {
      // Drivers see published missions or their accepted ones
      where.OR = [
        { status: MissionStatus.PUBLISHED },
        { driverId: user.id },
      ];
    }

    if (query.status) where.status = query.status;
    if (query.pickupCity) where.pickupCity = { equals: query.pickupCity, mode: 'insensitive' };
    if (query.deliveryCity) where.deliveryCity = { equals: query.deliveryCity, mode: 'insensitive' };
    if (query.country) {
      where.OR = [
        ...(Array.isArray(where.OR) ? where.OR : []),
        { pickupCountry: query.country.toUpperCase() },
        { deliveryCountry: query.country.toUpperCase() },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.mission.findMany({
        where,
        skip: query.skip,
        take: query.take,
        include: {
          vehicle: { select: { id: true, make: true, model: true, year: true, licensePlate: true, type: true } },
          client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true, companyName: true } },
          driver: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        },
        orderBy: { pickupAt: 'asc' },
      }),
      this.prisma.mission.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: {
        vehicle: { include: { photos: true } },
        client: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        driver: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true } },
        inspections: { include: { photos: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!mission) throw new NotFoundException('Mission introuvable.');
    this.assertCanView(mission, user);
    return mission;
  }

  async publish(id: string, userId: string) {
    const mission = await this.requireMission(id);
    if (mission.clientId !== userId) throw new ForbiddenException('Seul le client peut publier la mission.');
    if (mission.status !== MissionStatus.DRAFT) {
      throw new BadRequestException(`Publication impossible : la mission est au statut ${mission.status}.`);
    }
    return this.transition(id, MissionStatus.PUBLISHED, userId);
  }

  async accept(id: string, driverId: string) {
    const mission = await this.requireMission(id);
    if (mission.status !== MissionStatus.PUBLISHED) {
      throw new BadRequestException('Cette mission n\'est plus disponible.');
    }
    // On confie un véhicule à cette personne : son identité et son permis
    // doivent avoir été vérifiés par Axis. N'importe quel compte, client
    // compris, pouvait jusqu'ici accepter une mission publiée et repartir
    // avec le véhicule d'un client sans le moindre contrôle.
    await this.assertVerifiedDriver(driverId);
    return this.prisma.mission.update({
      where: { id },
      data: {
        driverId,
        status: MissionStatus.ACCEPTED,
        acceptedAt: new Date(),
        statusHistory: { create: { status: MissionStatus.ACCEPTED, changedBy: driverId } },
        conversation: {
          create: {
            type: 'MISSION',
            participants: {
              create: [{ userId: mission.clientId }, { userId: driverId }],
            },
          },
        },
      },
      include: { conversation: true },
    });
  }

  // Affectation par l'administrateur (Roger dispose de ses propres convoyeurs).
  // Contrairement à accept(), la mission n'a pas besoin d'être PUBLISHED : Roger
  // peut affecter directement depuis un brouillon, et réaffecter si besoin.
  async assignDriver(id: string, driverId: string, adminId: string) {
    const mission = await this.requireMission(id);

    const finalStatuses: MissionStatus[] = [MissionStatus.COMPLETED, MissionStatus.CANCELLED];
    if (finalStatuses.includes(mission.status)) {
      throw new BadRequestException('Mission clôturée : affectation impossible.');
    }
    if (mission.status === MissionStatus.DELIVERED) {
      throw new BadRequestException('Mission déjà livrée : affectation impossible.');
    }

    const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || driver.deletedAt) throw new NotFoundException('Convoyeur introuvable');
    if (driver.role !== UserRole.DRIVER && driver.role !== UserRole.ADMIN) {
      throw new BadRequestException('Cet utilisateur n\'est pas un convoyeur');
    }
    // Comme pour l'acceptation : pas de véhicule confié à un convoyeur dont
    // la pièce d'identité et le permis n'ont pas été validés. Roger peut
    // s'affecter lui-même.
    if (driver.role === UserRole.DRIVER) await this.assertVerifiedDriver(driverId);

    // DRAFT/PUBLISHED -> ACCEPTED. Une mission déjà démarrée garde son statut.
    const nextStatus =
      mission.status === MissionStatus.DRAFT || mission.status === MissionStatus.PUBLISHED
        ? MissionStatus.ACCEPTED
        : mission.status;

    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        driverId,
        status: nextStatus,
        acceptedAt: mission.acceptedAt ?? new Date(),
        statusHistory: {
          create: {
            status: nextStatus,
            changedBy: adminId,
            notes: `Affectation convoyeur : ${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim(),
          },
        },
      },
      include: {
        vehicle: { select: { id: true, make: true, model: true, licensePlate: true } },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true, avatarUrl: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.ensureMissionConversation(id, mission.clientId, driverId);

    const driverLabel = `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim();
    const trajet = `${updated.pickupCity} vers ${updated.deliveryCity}`;
    await Promise.all([
      this.notifySafe(
        mission.clientId,
        NotificationType.MISSION_ACCEPTED,
        'Convoyeur affecté',
        `${driverLabel || 'Un convoyeur'} prend en charge ton convoyage ${updated.reference} (${trajet}).`,
        { missionId: id, reference: updated.reference },
      ),
      this.notifySafe(
        driverId,
        NotificationType.MISSION_ACCEPTED,
        'Nouvelle mission',
        `${updated.reference} — ${trajet}. Enlèvement le ${updated.pickupAt.toLocaleDateString('fr-FR')}.`,
        { missionId: id, reference: updated.reference },
      ),
    ]);
    return updated;
  }

  // La conversation est unique par mission : on la crée si absente, sinon on
  // s'assure que le convoyeur affecté en fait partie (cas d'une réaffectation).
  private async ensureMissionConversation(missionId: string, clientId: string, driverId: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { missionId },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.conversation.create({
        data: {
          type: 'MISSION',
          missionId,
          participants: { create: [{ userId: clientId }, { userId: driverId }] },
        },
      });
      return;
    }

    await this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: existing.id, userId: driverId } },
      create: { conversationId: existing.id, userId: driverId },
      update: {},
    });
    // Un convoyeur remplacé n'a plus à lire les échanges avec le client.
    await this.prisma.conversationParticipant.deleteMany({
      where: { conversationId: existing.id, userId: { notIn: [clientId, driverId] } },
    });
  }

  async start(id: string, driverId: string) {
    const mission = await this.requireMission(id);
    if (mission.driverId !== driverId) throw new ForbiddenException('Vous n\'êtes pas le convoyeur affecté à cette mission.');
    if (mission.status !== MissionStatus.ACCEPTED) {
      throw new BadRequestException(`Départ impossible : la mission est au statut ${mission.status}.`);
    }
    // Pas de départ sans état des lieux de prise en charge signé des deux
    // parties : sans lui, aucun dommage constaté à l'arrivée ne peut être
    // attribué au transport.
    await this.assertInspectionSigned(id, 'PRE_DEPARTURE',
      'Fais d\'abord signer l\'état des lieux de départ (bouton « Départ ») par le client.');
    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.IN_PROGRESS,
        startedAt: new Date(),
        statusHistory: { create: { status: MissionStatus.IN_PROGRESS, changedBy: driverId } },
      },
    });
    await this.notifySafe(
      mission.clientId,
      NotificationType.MISSION_STARTED,
      'Véhicule en route',
      `Ton convoyage ${updated.reference} a démarré. Le suivi en temps réel est disponible.`,
      { missionId: id, reference: updated.reference },
    );
    return updated;
  }

  async deliver(id: string, driverId: string) {
    const mission = await this.requireMission(id);
    if (mission.driverId !== driverId) throw new ForbiddenException('Vous n\'êtes pas le convoyeur affecté à cette mission.');
    if (mission.status !== MissionStatus.IN_PROGRESS) {
      throw new BadRequestException(`Livraison impossible : la mission est au statut ${mission.status}.`);
    }
    // La livraison se constate par l'état des lieux d'arrivée signé : c'est
    // la pièce qui décharge Axis. Une fois « livrée », la mission quittait
    // l'écran du convoyeur et l'état des lieux ne pouvait plus être fait.
    await this.assertInspectionSigned(id, 'POST_DELIVERY',
      'Fais d\'abord signer l\'état des lieux d\'arrivée (bouton « Arrivée ») par le destinataire.');
    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.DELIVERED,
        deliveredAt: new Date(),
        statusHistory: { create: { status: MissionStatus.DELIVERED, changedBy: driverId } },
      },
    });
    await this.notifySafe(
      mission.clientId,
      NotificationType.MISSION_DELIVERED,
      'Véhicule livré',
      `Ton convoyage ${updated.reference} est arrivé à ${updated.deliveryCity}. Confirme la bonne réception depuis le suivi de ta commande.`,
      { missionId: id, reference: updated.reference },
    );
    return updated;
  }

  async complete(id: string, user: AuthenticatedUser) {
    const mission = await this.requireMission(id);
    // Le client clôture ; Roger peut le faire à sa place (client injoignable).
    if (mission.clientId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul le client peut clôturer la mission.');
    }
    if (mission.status !== MissionStatus.DELIVERED) {
      throw new BadRequestException(`Clôture impossible : la mission est au statut ${mission.status}.`);
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.COMPLETED,
        completedAt: new Date(),
        statusHistory: { create: { status: MissionStatus.COMPLETED, changedBy: user.id } },
      },
    });
    await this.notifySafe(mission.driverId, NotificationType.SYSTEM, 'Mission clôturée',
      `Le convoyage ${updated.reference} est clôturé. Merci !`, { missionId: id });
    return updated;
  }

  /**
   * Annulation, selon qui la demande :
   * - le client, tant que le véhicule n'est pas parti ;
   * - le convoyeur ne peut pas annuler la commande du client : il se désiste
   *   et la mission revient à Roger pour être réaffectée ;
   * - Roger (administrateur), à tout moment avant la clôture.
   * Roger est prévenu dans tous les cas, avec le remboursement à faire si le
   * client avait payé.
   */
  async cancel(id: string, user: AuthenticatedUser, reason?: string) {
    const mission = await this.requireMission(id);
    const isAdmin = user.role === UserRole.ADMIN;
    const isClient = mission.clientId === user.id;
    const isDriver = mission.driverId === user.id;
    if (!isAdmin && !isClient && !isDriver) throw new ForbiddenException();

    const finalStatuses: MissionStatus[] = [MissionStatus.COMPLETED, MissionStatus.CANCELLED];
    if (finalStatuses.includes(mission.status)) {
      throw new BadRequestException(`Annulation impossible : la mission est au statut ${mission.status}.`);
    }

    const admins = await this.prisma.user.findMany({ where: { role: UserRole.ADMIN, deletedAt: null }, select: { id: true } });

    if (isDriver && !isAdmin && !isClient) {
      if (mission.status !== MissionStatus.ACCEPTED) {
        throw new BadRequestException('Le véhicule est déjà pris en charge : appelle Axis pour tout changement.');
      }
      const updated = await this.prisma.mission.update({
        where: { id },
        data: {
          driverId: null,
          status: MissionStatus.PUBLISHED,
          statusHistory: { create: { status: MissionStatus.PUBLISHED, changedBy: user.id, notes: `Désistement du convoyeur${reason ? ` : ${reason}` : ''}` } },
        },
      });
      // Il quitte aussi la conversation avec le client.
      await this.prisma.conversationParticipant.deleteMany({
        where: { userId: user.id, conversation: { missionId: id } },
      });
      for (const a of admins) {
        await this.notifySafe(a.id, NotificationType.SYSTEM, 'Convoyeur désisté',
          `Le convoyeur s'est retiré de ${updated.reference}${reason ? ` (${reason})` : ''}. Mission à réaffecter.`, { missionId: id });
      }
      return updated;
    }

    const notStarted: MissionStatus[] = [MissionStatus.DRAFT, MissionStatus.PUBLISHED, MissionStatus.ACCEPTED];
    if (!isAdmin && !notStarted.includes(mission.status)) {
      throw new BadRequestException('Le véhicule est déjà en route : contacte Axis pour annuler.');
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: {
        status: MissionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        statusHistory: { create: { status: MissionStatus.CANCELLED, changedBy: user.id, notes: reason } },
      },
    });

    const paid = await this.prisma.payment.findFirst({ where: { missionId: id, status: 'PAID' } });
    const refund = paid
      ? ` Paiement de ${(paid.amountCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: paid.currency })} à rembourser selon les CGU.`
      : '';
    const by = isAdmin ? 'par Axis' : 'par le client';
    for (const a of admins) {
      if (a.id === user.id) continue;
      await this.notifySafe(a.id, NotificationType.MISSION_CANCELLED, 'Commande annulée',
        `${updated.reference} annulée ${by}${reason ? ` (${reason})` : ''}.${refund}`, { missionId: id });
    }
    await this.notifySafe(mission.driverId, NotificationType.MISSION_CANCELLED, 'Mission annulée',
      `Le convoyage ${updated.reference} est annulé. Tu n'as plus à t'en occuper.`, { missionId: id });
    if (isAdmin && !isClient) {
      await this.notifySafe(mission.clientId, NotificationType.MISSION_CANCELLED, 'Commande annulée',
        `Ta commande ${updated.reference} a été annulée par Axis.${paid ? ' Axis te contacte pour le remboursement.' : ''}`, { missionId: id });
    }
    return updated;
  }

  // Une notification qui échoue ne doit jamais faire échouer l'action métier.
  /**
   * Signature du contrat de convoyage par le client.
   *
   * Le contrat lui-même n'est pas stocké : il est reconstitué à l'identique à
   * partir des données de la mission. Ce qui est unique, et donc conservé,
   * c'est l'image de la signature — quelques kilo-octets, gardés en base pour
   * survivre aux redéploiements (le disque du serveur, lui, est éphémère).
   * Le document ainsi créé est ce qui permet à Roger de savoir qu'un client a
   * bien signé, et de régénérer le contrat signé en cas de litige.
   */
  async signContract(missionId: string, user: AuthenticatedUser, dto: SignContractDto) {
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId },
      select: CONTRACT_TERMS_SELECT,
    });
    if (!mission) throw new NotFoundException('Mission introuvable');
    if (mission.clientId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Seul le client donneur d\'ordre signe son contrat.');
    }

    const existing = await this.prisma.document.findFirst({
      where: { missionId, category: DocumentCategory.CONTRACT, signedAt: { not: null } },
    });
    if (existing) throw new BadRequestException('Ce contrat est déjà signé.');

    // Taille réelle de l'image, pour que fileSize ne soit pas un chiffre inventé.
    const payload = dto.signatureUrl.includes(',')
      ? dto.signatureUrl.slice(dto.signatureUrl.indexOf(',') + 1)
      : dto.signatureUrl;
    const isData = dto.signatureUrl.startsWith('data:');
    const isBase64 = isData && dto.signatureUrl.slice(0, 60).includes(';base64,');
    const fileSize = isData
      ? Buffer.from(payload, isBase64 ? 'base64' : 'utf8').length
      : dto.signatureUrl.length;
    // Le pavé de signature produit du SVG ; les photos de signature, du PNG.
    const mimeType = isData
      ? dto.signatureUrl.slice(5, dto.signatureUrl.indexOf(';') > 0 ? dto.signatureUrl.indexOf(';') : dto.signatureUrl.indexOf(','))
      : 'image/png';
    const ext = mimeType.includes('svg') ? 'svg' : mimeType.includes('jpeg') ? 'jpg' : 'png';

    const doc = await this.prisma.document.create({
      data: {
        ownerId: mission.clientId,
        missionId,
        category: DocumentCategory.CONTRACT,
        visibility: DocumentVisibility.SHARED,
        title: `Contrat de convoyage ${mission.reference}`,
        description: `${mission.pickupCity} vers ${mission.deliveryCity}`,
        fileUrl: dto.signatureUrl,
        fileName: `signature-${mission.reference}.${ext}`,
        mimeType,
        fileSize,
        signedAt: new Date(),
        signatureUrl: dto.signatureUrl,
        signedBy: user.id,
        contentHash: contractHash(mission),
      },
    });

    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: 'CONTRACT_SIGN',
          entity: 'Mission',
          entityId: missionId,
          metadata: { documentId: doc.id, reference: mission.reference },
        },
      })
      .catch(() => { /* la signature reste valable même si la trace échoue */ });

    // Roger doit savoir qu'un contrat vient d'être signé : c'est ce qui
    // débloque le départ du convoyage.
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, deletedAt: null },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) =>
        this.notifySafe(
          a.id,
          NotificationType.INSPECTION_SIGNED,
          'Contrat signé',
          `Le contrat du convoyage ${mission.reference} (${mission.pickupCity} vers ${mission.deliveryCity}) vient d'être signé par le client.`,
          { missionId, reference: mission.reference, documentId: doc.id },
        ),
      ),
    );

    return {
      id: doc.id,
      missionId,
      signedAt: doc.signedAt,
      signedBy: doc.signedBy,
      contentHash: doc.contentHash,
    };
  }

  /**
   * Vérification publique d'un contrat signé. On recalcule l'empreinte des
   * termes du dossier tels qu'ils sont aujourd'hui et on la compare à celle
   * figée au moment de la signature : si le prix, le véhicule ou le trajet
   * ont changé depuis, cela se voit.
   *
   * Aucune donnée personnelle n'est renvoyée : la page est accessible à
   * quiconque scanne le code du document.
   */
  async verifyContract(documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        signedAt: true,
        contentHash: true,
        mission: { select: CONTRACT_TERMS_SELECT },
      },
    });
    if (!doc || !doc.signedAt || !doc.mission) {
      throw new NotFoundException('Aucun contrat signé ne correspond à cette référence.');
    }
    const current = contractHash(doc.mission);
    return {
      reference: doc.mission.reference,
      signedAt: doc.signedAt,
      algorithm: 'SHA-256',
      hash: doc.contentHash,
      // contentHash est absent des signatures antérieures à sa mise en place :
      // on ne prétend pas alors que le dossier est intact.
      unchanged: doc.contentHash ? doc.contentHash === current : null,
    };
  }

  /**
   * Un convoyeur n'est habilité qu'avec une pièce d'identité ET un permis de
   * conduire approuvés. Le statut KYC global ne suffit pas : il vaut
   * « approuvé » dès que tous les documents déposés le sont, même si seul un
   * justificatif de domicile a été déposé.
   */
  private async assertVerifiedDriver(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, kycDocuments: { where: { status: 'APPROVED' }, select: { type: true } } },
    });
    if (!user || user.role !== UserRole.DRIVER) {
      throw new ForbiddenException('Seul un convoyeur peut accepter une mission.');
    }
    const approved = new Set(user.kycDocuments.map((d) => d.type));
    const hasId = approved.has('IDENTITY_CARD') || approved.has('PASSPORT');
    const hasLicense = approved.has('DRIVER_LICENSE');
    if (!hasId || !hasLicense) {
      throw new ForbiddenException(
        'Identité non vérifiée : une pièce d\'identité et un permis de conduire approuvés par Axis sont nécessaires pour accepter une mission.',
      );
    }
  }

  /**
   * Alerte de sécurité levée par le convoyeur (ou automatiquement quand il ne
   * répond pas après un arrêt prolongé). L'application annonçait « dispatching
   * prévenu » sans rien envoyer : chaque administrateur reçoit maintenant une
   * notification avec le nom, le téléphone et la position du convoyeur.
   */
  async driverAlert(
    id: string,
    driverId: string,
    body: { type?: 'PROLONGED_STOP' | 'SOS'; latitude?: number; longitude?: number },
  ) {
    const mission = await this.prisma.mission.findUnique({
      where: { id },
      include: { driver: { select: { firstName: true, lastName: true, phone: true } } },
    });
    if (!mission) throw new NotFoundException('Mission introuvable.');
    if (mission.driverId !== driverId) {
      throw new ForbiddenException('Vous n\'êtes pas le convoyeur affecté à cette mission.');
    }
    const who = mission.driver ? `${mission.driver.firstName} ${mission.driver.lastName}`.trim() : 'Le convoyeur';
    const phone = mission.driver?.phone ? ` (${mission.driver.phone})` : '';
    const where = body.latitude != null && body.longitude != null
      ? ` Position : https://maps.google.com/?q=${body.latitude.toFixed(5)},${body.longitude.toFixed(5)}`
      : '';
    const what = body.type === 'SOS' ? 'a déclenché une alerte SOS' : 'est arrêté depuis plus de 5 minutes et ne répond pas';
    const text = `${who}${phone} ${what} — mission ${mission.reference}.${where}`;

    await this.prisma.missionStatusHistory.create({
      data: { missionId: id, status: mission.status, changedBy: driverId, notes: `ALERTE : ${text}` },
    });
    const admins = await this.prisma.user.findMany({ where: { role: UserRole.ADMIN, deletedAt: null }, select: { id: true } });
    for (const a of admins) {
      await this.notifySafe(a.id, NotificationType.SYSTEM, body.type === 'SOS' ? 'SOS convoyeur' : 'Alerte convoyeur', text, {
        missionId: id,
        alert: body.type ?? 'PROLONGED_STOP',
        latitude: body.latitude,
        longitude: body.longitude,
      });
    }
    return { notified: admins.length };
  }

  private async assertInspectionSigned(missionId: string, type: 'PRE_DEPARTURE' | 'POST_DELIVERY', message: string) {
    const insp = await this.prisma.inspection.findUnique({
      where: { missionId_type: { missionId, type } },
      select: { status: true },
    });
    if (insp?.status !== 'SIGNED') throw new BadRequestException(message);
  }

  private async notifySafe(
    userId: string | null | undefined,
    type: NotificationType,
    title: string,
    body: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (!userId) return;
    try {
      await this.notifications.notify(userId, type, title, body, payload as never);
    } catch {
      /* journalisé côté service ; on continue */
    }
  }

  private async transition(id: string, status: MissionStatus, userId: string) {
    return this.prisma.mission.update({
      where: { id },
      data: {
        status,
        statusHistory: { create: { status, changedBy: userId } },
      },
    });
  }

  private async requireMission(id: string) {
    const mission = await this.prisma.mission.findUnique({ where: { id } });
    if (!mission) throw new NotFoundException('Mission introuvable.');
    return mission;
  }

  private assertCanView(mission: { clientId: string; driverId: string | null; status: MissionStatus }, user: AuthenticatedUser): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.id === mission.clientId) return;
    if (user.id === mission.driverId) return;
    if (user.role === UserRole.DRIVER && mission.status === MissionStatus.PUBLISHED) return;
    throw new ForbiddenException();
  }

  private generateReference(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AXI-${stamp}-${rand}`;
  }
}

/**
 * Termes du convoyage couverts par la signature. Y ajouter un champ change
 * l'empreinte des futures signatures — pas celle des signatures passées.
 */
const CONTRACT_TERMS_SELECT = {
  id: true,
  reference: true,
  clientId: true,
  driverId: true,
  pickupCity: true,
  pickupCountry: true,
  pickupAddress: true,
  pickupAt: true,
  deliveryCity: true,
  deliveryCountry: true,
  deliveryAddress: true,
  priceCents: true,
  distanceKm: true,
  vehicle: { select: { make: true, model: true, licensePlate: true } },
} as const;

type ContractTerms = {
  reference: string;
  clientId: string;
  driverId: string | null;
  pickupCity: string;
  pickupCountry: string;
  pickupAddress: string;
  pickupAt: Date;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryAddress: string;
  priceCents: number | null;
  distanceKm: number | null;
  vehicle: { make: string; model: string; licensePlate: string | null };
};

/** Empreinte SHA-256 des termes du contrat, sur une chaîne canonique. */
function contractHash(m: ContractTerms): string {
  const canonical = [
    'axis-contrat-convoyage',
    'v1',
    m.reference,
    m.clientId,
    m.driverId ?? '',
    m.pickupAddress,
    m.pickupCity,
    m.pickupCountry,
    m.pickupAt.toISOString(),
    m.deliveryAddress,
    m.deliveryCity,
    m.deliveryCountry,
    m.vehicle.make,
    m.vehicle.model,
    m.vehicle.licensePlate ?? '',
    String(m.priceCents ?? ''),
    String(m.distanceKm ?? ''),
  ].join('|');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
