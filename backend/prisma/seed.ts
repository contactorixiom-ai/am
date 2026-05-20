import { AccountType, NewsStatus, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

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
