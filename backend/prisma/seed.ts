import { AccountType, NewsStatus, Prisma, PrismaClient, RelayCarrier, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { COUNTRY_REGULATIONS } from '../src/modules/customs/customs.data';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding database...');

  const adminEmail = 'admin@axisimport.com';
  const clientEmail = 'client.demo@axisimport.com';
  const driverEmail = 'driver.demo@axisimport.com';

  const passwordHash = await argon2.hash('ChangeMe123!');

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Axis',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      accountType: AccountType.PROFESSIONAL,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: clientEmail },
    update: {},
    create: {
      email: clientEmail,
      passwordHash,
      firstName: 'Aïssatou',
      lastName: 'Diallo',
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      accountType: AccountType.INDIVIDUAL,
      emailVerifiedAt: new Date(),
    },
  });

  const driver = await prisma.user.upsert({
    where: { email: driverEmail },
    update: {},
    create: {
      email: driverEmail,
      passwordHash,
      firstName: 'Marc',
      lastName: 'Lemoine',
      role: UserRole.DRIVER,
      status: UserStatus.ACTIVE,
      accountType: AccountType.PROFESSIONAL,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driver.id },
    update: {},
    create: {
      userId: driver.id,
      licenseNumber: 'FR-1234567',
      licenseExpiresAt: new Date('2032-04-15'),
      licenseCategories: ['B', 'BE', 'C'],
      yearsOfExperience: 8,
      bio: 'Convoyeur professionnel basé à Paris, expérience Europe + import-export.',
      serviceCountries: ['FR', 'BE', 'NL', 'DE', 'LU', 'CH', 'ES', 'IT'],
      baseCity: 'Paris',
      baseLatitude: 48.8566,
      baseLongitude: 2.3522,
    },
  });

  const cat = await prisma.newsCategory.upsert({
    where: { slug: 'reglementation' },
    update: {},
    create: { slug: 'reglementation', name: 'Réglementation' },
  });

  await prisma.newsArticle.upsert({
    where: { slug: 'bienvenue-axis-import' },
    update: {},
    create: {
      slug: 'bienvenue-axis-import',
      title: 'Bienvenue sur Axis Import',
      excerpt: 'La plateforme dédiée au convoyage et à l\'import-export Europe ↔ Afrique subsaharienne.',
      body: '# Bienvenue\n\nAxis Import connecte clients, convoyeurs et expéditeurs.',
      status: NewsStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: cat.id,
      tags: ['lancement', 'plateforme'],
    },
  });

  // ── Points relais ──────────────────────────────────────────────────────
  const RELAY_POINTS = [
    // Hub Axis (gratuit, propriétaire)
    { carrier: RelayCarrier.AXIS_HUB,        externalId: 'AXIS-PARIS-01',  name: 'Hub Axis Paris',            address: '12 rue de Paradis',         postalCode: '75010', city: 'Paris',     country: 'FR', latitude: 48.8744, longitude: 2.3552,  openingHours: 'Lun-Ven 9h-19h · Sam 10h-17h' },
    { carrier: RelayCarrier.AXIS_HUB,        externalId: 'AXIS-LYON-01',   name: 'Hub Axis Lyon',             address: '47 rue de la République',   postalCode: '69002', city: 'Lyon',      country: 'FR', latitude: 45.7600, longitude: 4.8350,  openingHours: 'Lun-Ven 9h-18h' },
    { carrier: RelayCarrier.AXIS_HUB,        externalId: 'AXIS-MRS-01',    name: 'Hub Axis Marseille',        address: '5 rue Saint-Ferréol',       postalCode: '13001', city: 'Marseille', country: 'FR', latitude: 43.2965, longitude: 5.3700,  openingHours: 'Lun-Ven 9h-18h' },

    // Mondial Relay (échantillon, on chargera la vraie API plus tard)
    { carrier: RelayCarrier.MONDIAL_RELAY,  externalId: 'MR-75010-001',   name: 'Tabac de la Gare du Nord',  address: '194 rue La Fayette',        postalCode: '75010', city: 'Paris',     country: 'FR', latitude: 48.8800, longitude: 2.3540,  openingHours: 'Lun-Sam 7h-21h' },
    { carrier: RelayCarrier.MONDIAL_RELAY,  externalId: 'MR-75011-002',   name: 'Carrefour City Bastille',   address: '17 boulevard Beaumarchais', postalCode: '75011', city: 'Paris',     country: 'FR', latitude: 48.8540, longitude: 2.3700,  openingHours: 'Lun-Sam 8h-22h' },
    { carrier: RelayCarrier.MONDIAL_RELAY,  externalId: 'MR-69001-001',   name: 'Presse des Terreaux',       address: '12 rue de la Bourse',       postalCode: '69001', city: 'Lyon',      country: 'FR', latitude: 45.7670, longitude: 4.8340,  openingHours: 'Lun-Sam 7h-20h' },
    { carrier: RelayCarrier.MONDIAL_RELAY,  externalId: 'MR-13001-001',   name: 'Tabac Vieux-Port',          address: '4 quai de Rive Neuve',      postalCode: '13007', city: 'Marseille', country: 'FR', latitude: 43.2935, longitude: 5.3720,  openingHours: 'Lun-Sam 7h-20h' },
    { carrier: RelayCarrier.MONDIAL_RELAY,  externalId: 'MR-1000-BR-001', name: 'Press Centre',              address: '8 rue Neuve',               postalCode: '1000',  city: 'Bruxelles', country: 'BE', latitude: 50.8500, longitude: 4.3530,  openingHours: 'Lun-Sam 8h-19h' },

    // La Poste (Colissimo)
    { carrier: RelayCarrier.LA_POSTE,        externalId: 'LP-75009-001',  name: 'Bureau de Poste Opéra',     address: '7 rue de la Chaussée d\'Antin', postalCode: '75009', city: 'Paris',     country: 'FR', latitude: 48.8730, longitude: 2.3340, openingHours: 'Lun-Ven 8h-19h · Sam 8h-13h' },
    { carrier: RelayCarrier.LA_POSTE,        externalId: 'LP-69007-001',  name: 'La Poste Guillotière',      address: '14 rue de Marseille',       postalCode: '69007', city: 'Lyon',      country: 'FR', latitude: 45.7480, longitude: 4.8425,  openingHours: 'Lun-Ven 9h-18h' },

    // Chronopost
    { carrier: RelayCarrier.CHRONOPOST,      externalId: 'CHR-75019-001', name: 'Chronopost République',      address: '24 boulevard de la Villette', postalCode: '75019', city: 'Paris',   country: 'FR', latitude: 48.8775, longitude: 2.3700, openingHours: 'Lun-Ven 9h-19h' },

    // DPD
    { carrier: RelayCarrier.DPD,             externalId: 'DPD-1000-BR-1', name: 'DPD Pickup Centre-ville',   address: '40 rue du Marché aux Herbes', postalCode: '1000', city: 'Bruxelles', country: 'BE', latitude: 50.8480, longitude: 4.3540, openingHours: 'Lun-Sam 9h-20h' },
  ];

  for (const point of RELAY_POINTS) {
    await prisma.relayPoint.upsert({
      where: { externalId: point.externalId },
      update: {},
      create: point,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Seeded ${RELAY_POINTS.length} relay points`);

  // ── Réglementations douanières par pays (BSC / BESC / ECTN / FERI…) ──────
  for (const reg of COUNTRY_REGULATIONS) {
    await prisma.countryRegulation.upsert({
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
  // eslint-disable-next-line no-console
  console.log(`✅ Seeded ${COUNTRY_REGULATIONS.length} country regulations`);

  // eslint-disable-next-line no-console
  console.log('✅ Seed complete. Demo accounts:');
  // eslint-disable-next-line no-console
  console.log(`  - ${adminEmail} / ChangeMe123!`);
  // eslint-disable-next-line no-console
  console.log(`  - ${clientEmail} / ChangeMe123!`);
  // eslint-disable-next-line no-console
  console.log(`  - ${driverEmail} / ChangeMe123!`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
