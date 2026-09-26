#!/usr/bin/env node
/**
 * Applique les migrations au démarrage, en remplacement de
 * `prisma db push --accept-data-loss`.
 *
 * Pourquoi ce script plutôt que `prisma migrate deploy` seul : la base de
 * production a été créée par `db push`, donc son schéma est à jour mais elle
 * n'a aucun historique de migrations. `migrate deploy` essaierait alors de
 * rejouer la migration initiale sur des tables qui existent déjà, et
 * échouerait. On la « baseline » donc une fois : on déclare les migrations
 * déjà appliquées, puis on laisse `migrate deploy` faire son travail
 * normalement à tous les démarrages suivants.
 *
 * Les trois cas possibles :
 *   - base vide              -> aucun marquage, migrate deploy crée tout ;
 *   - base issue de db push  -> marquage unique, puis migrate deploy ;
 *   - base déjà migrée       -> rien à marquer, migrate deploy incrémente.
 */
const { execFileSync } = require('child_process');
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');
const { PrismaClient } = require('@prisma/client');

const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations');

function run(args) {
  execFileSync('npx', ['prisma', ...args], { stdio: 'inherit' });
}

function migrationNames() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function inspect() {
  // Prisma Client suffit : il est généré pendant le build, inutile d'ajouter
  // un pilote PostgreSQL rien que pour cette vérification.
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      // ::text : Prisma ne sait pas désérialiser le type regclass.
      `SELECT to_regclass('public."_prisma_migrations"')::text AS history,
              to_regclass('public."User"')::text               AS users`,
    );
    const r = rows[0] ?? {};
    let failedMigrations = [];
    if (r.history) {
      const failedRows = await prisma.$queryRawUnsafe(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
      );
      failedMigrations = failedRows.map((row) => row.migration_name);
    }
    return { hasHistory: !!r.history, hasSchema: !!r.users, failedMigrations };
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL absent — impossible de préparer la base.');
    process.exit(1);
  }

  const { hasHistory, hasSchema, failedMigrations } = await inspect();

  if (!hasHistory && hasSchema) {
    const names = migrationNames();
    console.log(
      `Base existante sans historique de migrations : marquage de ${names.length} migration(s) comme déjà appliquée(s).`,
    );
    for (const name of names) {
      run(['migrate', 'resolve', '--applied', name]);
    }
  }

  if (hasHistory && failedMigrations.length > 0) {
    console.log(
      `${failedMigrations.length} migration(s) bloquée(s) en échec détectée(s) : marquage comme déjà appliquée(s) car le schéma existe déjà.`,
    );
    for (const name of failedMigrations) {
      run(['migrate', 'resolve', '--applied', name]);
    }
  }

  run(['migrate', 'deploy']);
})().catch((e) => {
  console.error('Préparation de la base échouée :', e.message);
  process.exit(1);
});
