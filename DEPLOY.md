# Déploiement Axis Import — Guide pas-à-pas

Pour le user non-développeur. **Tu fais les clics, je m'occupe du code.**

---

## Étape 1 — Backend sur Railway (~10 min)

### A. Créer le projet

1. Va sur **https://railway.com** (tu es déjà connecté)
2. Clique sur **"+ New Project"** en haut à droite
3. Choisis **"Deploy from GitHub repo"**
4. Sélectionne le repo **`contactorixiom-ai/am`**
5. Railway demande la branche : choisis **`claude/axis-import-platform-4egTH`**

### B. Configurer le dossier racine

Railway détecte le repo mais ne sait pas que le backend est dans `backend/`. À configurer :

1. Dans ton service nouvellement créé, va dans **Settings** (icône engrenage)
2. Section **"Service"** → trouve le champ **"Root Directory"**
3. Saisis : `backend`
4. Clique **Save**

### C. Ajouter une base PostgreSQL

1. Dans ton projet (la page avec ton service), clique **"+ Create"** ou **"+ New"**
2. Choisis **"Database"** → **"Add PostgreSQL"**
3. ✅ Railway crée une Postgres et la connecte automatiquement à ton backend
4. La variable `DATABASE_URL` est injectée toute seule

### D. Variables d'environnement

Dans ton service backend → onglet **"Variables"**. Ajoute :

| Nom | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `API_PREFIX` | `api/v1` |
| `JWT_SECRET` | (clique "Generate" ou mets une longue chaîne aléatoire de 40+ caractères) |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_SECRET` | (autre chaîne aléatoire différente) |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `CORS_ORIGINS` | `*` (on restreindra plus tard) |
| `STORAGE_DRIVER` | `local` |
| `LOG_LEVEL` | `info` |

**Pour générer des secrets aléatoires** : tu peux utiliser https://generate-secret.vercel.app/40 (ouvre, copie la valeur).

### E. Exposer publiquement le service

1. Dans ton service backend → **Settings** → **Networking**
2. **Public Networking** → clique **"Generate Domain"**
3. Railway te donne une URL du style :
   `https://axis-import-backend-production-xxxx.up.railway.app`

### F. Vérifier que ça marche

Ouvre dans ton navigateur :
```
https://[TON-URL].up.railway.app/api/v1/health
```

Tu dois voir un JSON :
```json
{"status":"ok","uptime":12.34,"db":"ok"}
```

Si oui : 🎉 **backend déployé**. **Note l'URL**, je vais en avoir besoin pour l'app mobile.

### G. Explorer l'API

Ouvre :
```
https://[TON-URL].up.railway.app/api/v1/docs
```

→ Swagger interactif avec tous les endpoints. Tu peux tester un devis directement depuis le navigateur en cliquant sur `POST /quotes` → "Try it out".

---

## Étape 2 — App mobile sur Expo Go (~5 min)

L'app mobile fonctionne avec **Expo Go** (déjà installée sur ton tel). Pour la voir, j'ai besoin de publier le code sur le service Expo.

### A. Crée un compte Expo (gratuit, 2 min)

1. Va sur **https://expo.dev/signup**
2. Inscris-toi (email ou GitHub)
3. **Note ton "username"** (ex: `ahmd-elm11`)

### B. Donne-moi ton username Expo

Réponds simplement dans le chat :

> Mon username Expo est : `xxxxxxx`

Je vais alors :
- Configurer le projet mobile sous ton nom
- Publier l'app sur Expo
- Te donner un **lien direct** à ouvrir dans Expo Go

### C. Quand je t'aurai donné le lien

1. Sur ton tel, ouvre **Expo Go**
2. Connecte-toi avec ton compte Expo (icône profil en bas)
3. Tu verras **"Axis Import"** dans tes projets
4. Tap dessus → l'app se charge

L'app pointera vers ton backend Railway → tu peux tester un vrai devis, créer un compte, etc.

---

## Étape 3 — Tu testes, tu me dis ce qui cloche

Quand tout marche :
- Crée un compte test depuis l'app mobile
- Fait un devis "Paris → Bruxelles" en convoyage
- Fait un devis "Lyon → Dakar" en colis aérien
- Réserve un colis
- Suis-le

Tu me reportes les bugs et tu me dis ce qui doit changer côté UX, tarif, copy, etc. Je corrige et je redéploie.

---

## Ce dont j'ai besoin de toi MAINTENANT

1. ✅ Finir l'étape 1 sur Railway
2. ✅ Me donner ton **URL Railway** une fois déployée
3. ✅ Me donner ton **username Expo**

Et je m'occupe du reste.
