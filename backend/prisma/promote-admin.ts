/**
 * Promotion d'un compte en ADMIN (poste de Roger).
 *
 * Les inscriptions créent des comptes CLIENT par défaut ; l'espace admin est
 * réservé au rôle ADMIN. Ce script passe un compte existant en ADMIN, une fois.
 *
 * Utilisation (depuis backend/, avec DATABASE_URL configuré — ex. sur Railway) :
 *   npm run promote:admin -- roger@exemple.com
 *
 * Idempotent : relancer sur un compte déjà ADMIN ne fait rien de plus.
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    // eslint-disable-next-line no-console
    console.error('❌ Email manquant.\n   Utilisation : npm run promote:admin -- roger@exemple.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // eslint-disable-next-line no-console
    console.error(`❌ Aucun compte trouvé pour « ${email} ».`);
    console.error('   Vérifie que Roger s\'est bien inscrit dans l\'app avec cet email.');
    process.exit(1);
  }

  if (user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE) {
    // eslint-disable-next-line no-console
    console.log(`✅ ${email} est déjà ADMIN (actif). Rien à faire.`);
    return;
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  });

  // eslint-disable-next-line no-console
  console.log(
    `✅ ${updated.firstName} ${updated.lastName} (${email}) est maintenant ADMIN et actif.\n` +
      '   Il peut se déconnecter/reconnecter dans l\'app pour voir l\'Espace admin.',
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ Échec de la promotion :', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
