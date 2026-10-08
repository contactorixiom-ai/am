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

// Migrations écrites pour être rejouables sans risque (IF NOT EXISTS, reprise
// de données conditionnelle). Elles sont réexécutées à chaque démarrage : si
// l'une d'elles a été déclarée « appliquée » sans l'avoir été (correctif
// automatique, échec en cours de route), ce qui manque est créé.
const REPLAYABLE = [
  '20260924000000_password_reset',
  '20260924010000_terms_acceptance',
  '20260925000000_invoice_numbers',
  '20260925010000_billing_address',
  '20261001000000_payment_refunded',
  '20261008000000_quote_lines',
];

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

  // Migration restée en échec : on la marque « annulée » pour que
  // migrate deploy la rejoue. La déclarer « appliquée » (correctif proposé
  // automatiquement) débloquait le démarrage mais pouvait laisser des tables
  // ou colonnes manquantes, et l'application planter plus tard.
  if (hasHistory && failedMigrations.length > 0) {
    console.log(`${failedMigrations.length} migration(s) en échec : nouvelle tentative (${failedMigrations.join(', ')}).`);
    for (const name of failedMigrations) {
      run(['migrate', 'resolve', '--rolled-back', name]);
    }
  }

  run(['migrate', 'deploy']);

  for (const name of REPLAYABLE) {
    const file = join(MIGRATIONS_DIR, name, 'migration.sql');
    if (existsSync(file)) {
      run(['db', 'execute', '--file', file, '--schema', join(__dirname, '..', 'prisma', 'schema.prisma')]);
    }
  }

  // Contrôle final, sans rien modifier : la base correspond-elle au schéma
  // attendu par l'application ? Un écart est signalé en clair dans les logs.
  try {
    execFileSync(
      'npx',
      ['prisma', 'migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel',
        join(__dirname, '..', 'prisma', 'schema.prisma'), '--exit-code'],
      { stdio: 'pipe' },
    );
    console.log('Base conforme au schéma de l\'application.');
  } catch (e) {
    if (e.status === 2) {
      console.warn('ATTENTION : la base diffère du schéma attendu :\n' + String(e.stdout || ''));
    } else {
      console.warn('Contrôle de la base impossible :', e.message);
    }
  }
})().catch((e) => {
  console.error('Préparation de la base échouée :', e.message);
  process.exit(1);
});
