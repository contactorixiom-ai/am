# 🚀 Axis Import — Guide de déploiement complet

## 📍 État actuel

Tu as déjà :
- ✅ Compte GitHub avec le repo `contactorixiom-ai/am`
- ✅ Compte Railway connecté au dépôt
- ✅ Compte Expo (username **`am27z`**)
- ✅ Expo Go installé sur ton téléphone

Il reste à finaliser le **déploiement du backend** sur Railway et à **publier l'app mobile**.

---

## 🌐 URLs prévues

| Service | URL |
|---|---|
| **Prototype design** (Figma-like) | https://contactorixiom-ai.github.io/am/ |
| **App mobile (web preview)** | https://contactorixiom-ai.github.io/am/app/ |
| **API backend** | `https://[ton-railway].up.railway.app/api/v1` |
| **Swagger interactif** | `https://[ton-railway].up.railway.app/api/v1/docs` |
| **App mobile (vraie)** | Via Expo Go avec project `@am27z/axis-import` |

---

## 1️⃣ Backend Railway

### Variables d'environnement à ajouter

Dans **ton service Railway → onglet Variables**, ajoute ceci :

```
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
JWT_SECRET=CHANGE-ME-LONG-RANDOM-STRING-40-CHARS-MIN
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=CHANGE-ME-DIFFERENT-LONG-RANDOM-STRING
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGINS=*
STORAGE_DRIVER=local
LOG_LEVEL=info
```

**Pour générer les 2 secrets** : ouvre https://generate-secret.vercel.app/40 deux fois, copie les deux valeurs (une pour JWT_SECRET, une pour JWT_REFRESH_SECRET).

### Configuration importante

1. **Root directory** : `backend` (Settings → Service → Root Directory)
2. **Postgres** : "+ Create" → Database → PostgreSQL (auto-injecte DATABASE_URL)
3. **Domaine public** : Settings → Networking → "Generate Domain"

### Vérification

Une fois déployé, ouvre `https://[ton-url].up.railway.app/api/v1/health`. Tu dois voir :
```json
{"status":"ok","uptime":12.34,"db":"ok"}
```

Si tu vois ça → 🎉 **backend opérationnel**.

**Note l'URL et envoie-la moi.**

---

## 2️⃣ App mobile (web preview)

**Automatique** dès qu'on aura ajouté ton URL Railway en secret GitHub.

### Étape : ajouter le secret EXPO_PUBLIC_API_URL

1. Va sur https://github.com/contactorixiom-ai/am/settings/secrets/actions
2. Clique **"New repository secret"**
3. **Name** : `EXPO_PUBLIC_API_URL`
4. **Value** : `https://[ton-url].up.railway.app/api/v1`
5. **Save**

Au prochain push, GitHub Actions rebuilde le web bundle avec ton URL backend et le déploie sur `https://contactorixiom-ai.github.io/am/app/`.

→ Tu peux **tester l'app dans ton navigateur** depuis n'importe quel appareil.

---

## 3️⃣ App mobile (Expo Go natif)

Pour avoir l'expérience native iOS/Android :

### A. Installation locale (option A — si tu as un PC)

```bash
git clone https://github.com/contactorixiom-ai/am
cd am/mobile
npm install
EXPO_PUBLIC_API_URL=https://[ton-railway].up.railway.app/api/v1 npx expo start --tunnel
```

→ Scanne le QR code dans Expo Go.

### B. Publication EAS (option B — sans PC)

J'ai configuré le projet avec `owner: "am27z"`. Pour publier sur ton compte Expo :

1. Crée un **Access Token** sur https://expo.dev/accounts/am27z/settings/access-tokens
2. Donne-moi le token dans le chat (commence par `eas_xxx…`) — je publierai depuis ici
3. Tu ouvres Expo Go → tes projets → "axis-import" → ça charge

**OU bien plus simple** : utilise simplement la web preview de l'étape 2️⃣, qui marche dans le navigateur de ton téléphone aussi (même UX).

---

## 4️⃣ Test end-to-end

Une fois le backend déployé + le secret ajouté :

1. Ouvre **https://contactorixiom-ai.github.io/am/app/** sur n'importe quel appareil
2. Crée un compte client (email + mdp)
3. Demande un devis pour **un envoi colis Paris → Dakar** :
   - Poids : 8 kg
   - Catégorie : effets personnels
   - Transport : **aérien**
4. Choisis le mode de récupération : **point relais Mondial Relay**
5. La liste des points près de Paris s'affiche
6. Sélectionne-en un
7. Tu vois le devis avec :
   - Prix EUR
   - Prix converti en **FCFA pour le destinataire au Sénégal**
   - Décomposition (transport + récupération + TVA)
   - Smart hints contextuels
   - Carte interactive Paris → Dakar
8. Remplis les coordonnées du destinataire
9. Confirme → tu reçois une **référence AXP-xxx**
10. Va dans **Mes envois** → tu vois ton colis avec son statut

---

## 5️⃣ Workflow de mise à jour

Désormais, chaque push sur la branche `claude/axis-import-platform-4egTH` :
- Railway redéploie le backend automatiquement
- GitHub Actions rebuilde et redéploie le web preview de l'app
- Tes pages publiques sont à jour en 2-3 minutes

Tu n'as plus rien à faire — tu me dis ce qui doit changer, je push, ça se déploie.

---

## 📞 Si quelque chose bloque

Envoie-moi une **capture d'écran** de l'écran où tu es coincé. Je débogue en direct.

**Les 3 infos dont j'ai besoin pour finaliser** :
1. ✅ Ton URL Railway (`https://xxx.up.railway.app`)
2. ✅ Confirmation que tu as ajouté le secret `EXPO_PUBLIC_API_URL` sur GitHub
3. (Optionnel) Access Token Expo si tu veux la publication native sous `@am27z/axis-import`
