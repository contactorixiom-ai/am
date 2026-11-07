# Axis Import — Backend API

API NestJS pour la plateforme **Axis Import** : convoyage automobile et import-export Europe ↔ Afrique subsaharienne francophone.

## Stack

- **Node.js 20+** / **TypeScript 5**
- **NestJS 10** (modulaire, REST + WebSocket via Socket.IO)
- **PostgreSQL 16** + **PostGIS** (tracking GPS)
- **Prisma 5** (ORM + migrations)
- **Redis 7** (cache, pub/sub WebSocket à venir)
- **JWT + refresh tokens** (Passport, argon2id pour les mots de passe)
- **Swagger** auto-généré sur `/api/v1/docs`

## Modules

| Module | Rôle |
|---|---|
| `auth` | Inscription, connexion, refresh, logout |
| `users` | Profils, profils convoyeurs, listing |
| `vehicles` | CRUD véhicules (clients) |
| `missions` | Missions de convoyage et machine à états |
| `gps` | Tracking REST + WebSocket temps réel |
| `inspections` | États des lieux avec photos et signatures |
| `documents` | Documents administratifs (contrats, CMR, douane…) |
| `messaging` | Chat + appels audio/vidéo (signalisation) |
| `parcels` | Envoi de colis vers l'Afrique + tracking public |
| `news` | Articles d'actualité (publics) |
| `notifications` | Notifications in-app + tokens push |
| `storage` | Upload fichiers (local / S3 à venir) |
| `payments` | Stub Stripe |

## Démarrage rapide

```bash
# 1. Installer les dépendances
cd backend
npm install

# 2. Configurer l'environnement
cp .env.example .env
# (Éditez .env si besoin — par défaut ça pointe sur le docker-compose local)

# 3. Lancer les services (Postgres+PostGIS, Redis, Adminer)
docker compose up -d

# 4. Générer le client Prisma + appliquer les migrations
npm run prisma:generate
npm run prisma:migrate -- --name init

# 5. Seed (crée admin / client / convoyeur de démo)
npm run prisma:seed

# 6. Démarrer l'API en watch
npm run start:dev
```

- API : http://localhost:3000/api/v1
- Swagger : http://localhost:3000/api/v1/docs
- Adminer : http://localhost:8080 (server: `postgres`, user: `axis`, pass: `axis_dev`, db: `axis_import`)

## Comptes de démo (après seed)

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@axisimport.com` | `ChangeMe123!` | ADMIN |
| `client.demo@axisimport.com` | `ChangeMe123!` | CLIENT |
| `driver.demo@axisimport.com` | `ChangeMe123!` | DRIVER |

## Cycle de vie d'une mission

```
DRAFT  →  PUBLISHED  →  ACCEPTED  →  IN_PROGRESS  →  DELIVERED  →  COMPLETED
                                          ↓
                                      CANCELLED (à tout moment avant COMPLETED)
```

Endpoints clés :
- `POST /missions` — créer (DRAFT)
- `POST /missions/:id/publish` — publier
- `POST /missions/:id/accept` — un convoyeur accepte
- `POST /missions/:id/start` — démarrer le convoyage
- `POST /missions/:id/deliver` — marquer comme livré
- `POST /missions/:id/complete` — clôture par le client
- `POST /missions/:id/cancel` — annuler

## Temps réel

- WebSocket GPS : `/gps` — événement `subscribe-mission` puis `location`
- WebSocket Messaging : `/messaging` — événements `join-conversation`, `message`, `typing`, `call`

## Tests

```bash
npm test         # unit
npm run test:e2e # end-to-end (à venir)
```

## Roadmap

- [ ] Migrations Prisma + Prisma Studio
- [ ] Upload réel via `@nestjs/platform-express` (multer)
- [ ] Driver S3 (`@aws-sdk/client-s3`)
- [ ] Stripe Connect (commissions plateforme)
- [ ] Push FCM/APNS via `PushToken`
- [ ] Geo-search drivers (PostGIS `ST_DWithin`)
- [ ] Génération PDF contrats (Puppeteer ou pdfkit)
- [ ] Tests e2e (auth, missions, inspections)
