/**
 * Refuse de démarrer en production avec des clés de signature faibles.
 *
 * La configuration retombait sur « change-me » quand JWT_SECRET n'était pas
 * défini. Avec une clé connue, n'importe qui peut fabriquer un jeton au nom
 * de n'importe quel compte — administrateur compris — et lire ou modifier
 * tous les dossiers. Mieux vaut un serveur qui ne démarre pas et le dit
 * clairement qu'un serveur ouvert à tous sans que personne le sache.
 */
const KNOWN_DEFAULTS = new Set([
  'change-me',
  'change-me-too',
  'change-me-in-production-use-a-long-random-string',
  'change-me-too-different-from-above',
  'secret',
]);

const MIN_LENGTH = 32;

export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  const check = (name: string) => {
    const value = env[name];
    if (!value) problems.push(`${name} n'est pas défini`);
    else if (KNOWN_DEFAULTS.has(value)) problems.push(`${name} vaut une valeur d'exemple connue`);
    else if (value.length < MIN_LENGTH) problems.push(`${name} fait moins de ${MIN_LENGTH} caractères`);
  };
  check('JWT_SECRET');
  check('JWT_REFRESH_SECRET');
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET et JWT_REFRESH_SECRET sont identiques');
  }

  if (problems.length > 0) {
    throw new Error(
      [
        'Démarrage refusé : clés de signature des sessions insuffisantes.',
        ...problems.map((p) => `  - ${p}`),
        'Définissez deux valeurs aléatoires distinctes dans les variables du service, par exemple :',
        '  openssl rand -hex 48',
      ].join('\n'),
    );
  }
}
