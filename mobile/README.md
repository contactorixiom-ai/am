# Axis Import — App Mobile

App React Native + Expo (iOS + Android + Web) pour la plateforme Axis Import.

## Stack

- **Expo 51** + **React Native 0.74**
- **TypeScript** strict
- **Manrope** (Google Fonts) — police du design system
- **Axios** + interceptor refresh token automatique
- **AsyncStorage** pour la session

## Démarrer en 3 minutes (depuis ton PC)

```bash
# 1. Aller dans le dossier mobile
cd mobile

# 2. Installer les dépendances
npm install

# 3. Lancer Expo
npm start
```

Un QR code s'affiche dans le terminal.

### Sur ton téléphone

1. Installer **Expo Go** depuis l'App Store (iOS) ou Play Store (Android)
2. Ouvrir Expo Go, scanner le QR code
3. L'app se charge automatiquement → tu vois l'écran d'onboarding Axis

### Sans téléphone (web preview)

```bash
npm run web
```

→ ouvre `http://localhost:8081` dans Chrome, tu vois l'app dans le navigateur (utile pour itérer vite).

## Écrans actuels (v0.1)

| Écran | Statut |
|---|---|
| Onboarding | ✅ |
| Accueil | ✅ basique |
| Devis convoyage | ✅ branché sur `POST /quotes` du backend |
| Nouvelle demande (4 cartes) | ⏳ à faire |
| Suivi temps réel | ⏳ à faire |
| Documents | ⏳ à faire |
| Messagerie | ⏳ à faire |
| Actualités | ⏳ à faire |
| Drawer menu | ⏳ à faire |
| État des lieux chauffeur (8 angles) | ⏳ à faire |
| Contrat + signature | ⏳ à faire |

## Brancher sur le backend

Par défaut l'app pointe sur `http://localhost:3000/api/v1` (cf. `app.json` → `extra.apiUrl`).

Pour tester en local depuis ton téléphone :
- Soit utiliser un **tunnel** : `npx expo start --tunnel`
- Soit mettre l'URL de ton backend déployé (ex: Railway) dans `app.json`

## Structure

```
mobile/
├── App.tsx                    # entry point
├── app.json                   # config Expo
├── package.json
├── tsconfig.json
├── src/
│   ├── theme/
│   │   ├── tokens.ts          # design tokens (port de design/tokens.jsx)
│   │   └── ThemeProvider.tsx  # light / dark / auto
│   ├── components/
│   │   ├── Surface.tsx
│   │   ├── Pill.tsx
│   │   ├── Button.tsx
│   │   └── AxisLogo.tsx
│   ├── api/
│   │   ├── client.ts          # axios + refresh token auto
│   │   └── quotes.ts
│   └── screens/
│       ├── OnboardingScreen.tsx
│       ├── HomeScreen.tsx
│       └── QuoteScreen.tsx
└── assets/                    # icon.png, splash.png à ajouter
```

## TODO immédiat

- [ ] Ajouter les assets `icon.png`, `splash.png`, `adaptive-icon.png` depuis le logo Axis
- [ ] Compléter les composants : `Avatar`, `TabBar`, `Field`, `SectionHead`, `StatusBadge`, `RouteMap`
- [ ] Ajouter `react-navigation` (stack + bottom tabs) pour la vraie navigation
- [ ] Porter les 10 écrans Client et 3 écrans Driver depuis `/design/`
- [ ] Brancher tous les modules API (auth, missions, gps, messaging, etc.)
- [ ] Carte temps réel avec `react-native-maps`
- [ ] Caméra état des lieux avec `expo-camera`
- [ ] Signature électronique avec `react-native-signature-canvas`
