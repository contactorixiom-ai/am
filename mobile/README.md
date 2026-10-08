# Axis Import — App Mobile

App React Native + Expo (iOS + Android + Web) pour la plateforme Axis Import.

## Stack

- **Expo 51** + **React Native 0.74** + **TypeScript** strict
- **React Navigation** 6 (native stack + bottom tabs)
- **react-native-maps** (Mapbox/Apple/Google selon la plateforme)
- **Manrope** (Google Fonts) — police du design system
- **Axios** + interceptor refresh token automatique
- **AsyncStorage** pour la session

## MVP — Flux complets

### Convoyage voiture Europe
Onboarding → Inscription/Login → Accueil → Service Picker → Form trajet+véhicule+options → Devis (avec carte) → Réservation

### Envoi colis Afrique
Onboarding → Inscription/Login → Accueil → Service Picker → Form trajet+poids+catégorie+mode aérien/maritime → Devis (avec carte) → Coordonnées destinataire → Réservation → Suivi temps réel

## Tarifs intégrés
- **Convoyage Europe** : 0,66 €/km HT, min 50 € HT
- **Colis aérien** : dès 8,50 €/kg HT (5-10 jours)
- **Colis maritime** : dès 4,50 €/kg HT (30-45 jours)
- **Options** : Express +22%, Assurance Premium 35€, Porte-à-porte +15%, Enlèvement weekend 40€
- **TVA** : 20%

## Lancer l'app (depuis ton PC)

```bash
cd mobile
npm install
npm start
```

→ Scanner le QR code avec **Expo Go** sur ton téléphone (App Store / Play Store).

Pour tester depuis un téléphone qui n'est pas sur le même Wi-Fi :
```bash
npm run start:tunnel
```

## Branchement backend

Par défaut : `http://localhost:3000/api/v1`. À modifier dans `app.json` → `extra.apiUrl` quand le backend sera déployé.

## Écrans implémentés (v0.1)

| Écran | Statut |
|---|---|
| Onboarding | ✅ |
| Inscription | ✅ |
| Connexion | ✅ |
| Accueil (tabs) | ✅ |
| Mes envois (tabs) | ✅ |
| Documents (tabs) | ⏳ placeholder |
| Profil (tabs) | ✅ |
| Choix du service | ✅ |
| Demande convoyage voiture | ✅ |
| Demande envoi colis | ✅ |
| Devis (avec carte interactive) | ✅ |
| Coordonnées destinataire (colis) | ✅ |
| Confirmation de réservation | ✅ |
| Suivi temps réel | ✅ |
| Drawer menu principal | ⏳ |
| État des lieux chauffeur | ⏳ |
| Contrat + signature | ⏳ |
| Actualités | ⏳ |

## Structure

```
mobile/
├── App.tsx
├── src/
│   ├── api/                # client HTTP + endpoints par module
│   ├── components/         # primitives UI du design system
│   ├── navigation/         # stack racine + bottom tabs
│   ├── screens/            # écrans
│   ├── state/              # contextes (Session, Theme)
│   └── theme/              # tokens design (light + dark)
```
