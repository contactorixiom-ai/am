// Adresse publique de l'API, utilisée pour construire l'URL des fichiers.
// Railway expose le domaine du service ; en local on retombe sur le port.
function publicApiBase(): string {
  const prefix = process.env.API_PREFIX ?? 'api/v1';
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/${prefix}`;
  }
  return `http://localhost:${process.env.PORT ?? '3000'}/${prefix}`;
}

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },

  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    // Sur Railway, le disque du conteneur est recréé à chaque déploiement :
    // tout fichier écrit ailleurs que sur un volume est perdu. Dès qu'un
    // volume est attaché au service, la plateforme expose son point de
    // montage — on s'y range automatiquement, sans réglage supplémentaire.
    localPath:
      process.env.STORAGE_LOCAL_PATH ??
      (process.env.RAILWAY_VOLUME_MOUNT_PATH
        ? `${process.env.RAILWAY_VOLUME_MOUNT_PATH}/uploads`
        : './uploads'),
    // Les fichiers sont servis par l'API elle-même, derrière authentification :
    // une pièce d'identité n'a rien à faire sur une URL publique devinable.
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? publicApiBase() + '/storage/file',
    onVolume: Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.STORAGE_LOCAL_PATH),
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'eu-west-3',
      bucket: process.env.S3_BUCKET ?? 'axis-import',
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
    },
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '300', 10),
  },

  // Adresse de l'application pour les clients (web). Les liens de
  // réinitialisation du mot de passe pointent vers elle.
  appUrl: (process.env.PUBLIC_APP_URL ?? 'https://contactorixiom-ai.github.io/am/app/').replace(/\/?$/, '/'),

  // Envoi d'e-mails transactionnels (facultatif). Sans clé, les liens de
  // réinitialisation sont seulement générés côté administrateur, à
  // transmettre par WhatsApp ou SMS.
  mail: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.MAIL_FROM ?? 'Axis Import <no-reply@axis-import.fr>',
  },

  // Jeton d'accès Expo, seulement si la « sécurité renforcée des
  // notifications » est activée dans le projet Expo.
  push: {
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    currency: process.env.STRIPE_CURRENCY ?? 'eur',
  },

  logLevel: process.env.LOG_LEVEL ?? 'info',
});
