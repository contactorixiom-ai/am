# Plan de développement multi-agents — Axis Import

Ce document définit **qui code quoi** pour permettre à plusieurs agents de
travailler en parallèle sans se marcher dessus. À lire avant toute session
de dev parallèle.

## Principe en 3 phases

1. **Fondations (séquentiel, orchestrateur)** — on fige les *contrats*
   partagés. Tant que ce n'est pas stable, on ne parallélise pas.
2. **Développement (parallèle, worktrees isolés)** — chaque agent code son
   domaine dans sa propre copie Git. Il ne modifie **que** ses fichiers.
3. **Intégration (séquentiel, orchestrateur)** — on fusionne agent par
   agent, on règle les points de contact, on lance typecheck + build.

## Règle d'or : les fichiers gelés

Aucun agent ne modifie seul ces fichiers (= zone partagée). Toute
évolution passe par l'orchestrateur, en début ou fin de cycle :

- `mobile/src/navigation/RootNavigator.tsx`
- `mobile/src/navigation/types.ts`
- `mobile/App.tsx`
- `mobile/src/theme/*` (tokens, ThemeProvider)
- `mobile/src/components/` partagés : `Button`, `Field`, `Surface`, `Pill`,
  `AppBar`, `Icons`, `SectionHead`, `Avatar`, `DotLoader`
- `backend/prisma/schema.prisma`
- `backend/src/app.module.ts`, `main.ts`

Un agent qui a besoin d'une route, d'un type ou d'un champ Prisma le
**demande** dans son rapport ; l'orchestrateur l'ajoute.

## Les 4 agents et leur périmètre

### Agent 1 — Convoyage (Europe)
**Mission** : tout le cycle de convoyage véhicule en Europe.
- **Backend** : `modules/missions`, `modules/vehicles`, `modules/inspections`,
  `modules/gps`
- **Mobile** : `screens/CarRequestScreen`, `MissionDetailsScreen`,
  `VehicleInspectionScreen`, `TrackingScreen` (cas mission),
  `components/LiveConvoyPanel`, `LiveConvoyMap*`, `VehicleDiagram`
- **Livrables** : barème 0,66 €/km, états des lieux bilatéraux, suivi GPS
  temps réel, statut chauffeur.

### Agent 2 — Colis Afrique ⇄ Europe
**Mission** : envoi de colis/marchandises, Afrique subsaharienne ⇄ Europe.
- **Backend** : `modules/parcels`, `modules/relay-points`,
  `modules/quotes` (volet colis), orchestration transporteurs tiers
- **Mobile** : `screens/ParcelRequestScreen`, `PickupModeScreen`,
  `RelayPointPickerScreen`, `RecipientDetailsScreen`, `TrackingScreen`
  (cas colis), `components/LogisticsPartnerCard`, `utils/logisticsPartners`
- **Livrables** : barèmes 8,50 €/kg aérien / 4,50 €/kg maritime, conversion
  FCFA, multimodal premier kilomètre, grille tarifaire par zone (interne,
  jamais visible client — un seul prix final).

### Agent 3 — Administratif & réglementation
**Mission** : conformité documentaire et douanière par pays.
- **Backend** : `modules/documents` (génération, catégories), nouveau
  `modules/customs` (réglementation par pays, BSC, certificats d'origine,
  documents requis selon destination)
- **Mobile** : `screens/DocumentsScreen`, `VehicleDocsScreen`, checklists
  douanières par pays, `utils/pdf` (factures, contrats, PV)
- **Livrables** : matrice des documents requis par pays (SN, CI, CM, BJ,
  TG, GA…), génération PDF conforme, alertes d'expiration.

### Agent 4 — Sécurité & identité
**Mission** : authentification, signature électronique, dépôt de pièces.
- **Backend** : `modules/auth`, `modules/users` (KYC), `modules/storage`,
  signature électronique (eIDAS)
- **Mobile** : `screens/SecuritySettingsScreen`, `KycVerificationScreen`,
  `LoginScreen`, `RegisterScreen`, `components/SignaturePad`, Face ID / PIN
- **Livrables** : JWT + refresh rotation, 2FA, Face ID/PIN, KYC chauffeur,
  signature eIDAS, chiffrement, RGPD.

## Points de couture (à surveiller à l'intégration)

| Frontière | Agents concernés | Contrat |
|---|---|---|
| `quotes` | Convoyage + Colis | Module partagé : figer le DTO de devis avant |
| `documents` ↔ signature | Admin + Sécurité | Admin génère le PDF, Sécurité fournit la signature |
| Tracking (mission vs colis) | Convoyage + Colis | 1 écran, 2 branches `kind` — découper en 2 sous-composants |
| Navigation/types | Tous | Gelé — orchestrateur uniquement |

## Git : worktrees isolés

```bash
# Une branche + un dossier de travail par agent
git worktree add ../am-convoyage   -b feat/convoyage
git worktree add ../am-colis        -b feat/colis
git worktree add ../am-admin        -b feat/admin
git worktree add ../am-securite     -b feat/securite
```

Chaque agent travaille dans son dossier, commit sur sa branche.
L'orchestrateur merge ensuite `feat/*` → `develop` une par une.

## Definition of Done (par agent, avant merge)

- [ ] `npx tsc --noEmit` passe (mobile)
- [ ] `npm run build` passe (backend)
- [ ] Aucun fichier gelé modifié (sinon : le signaler, pas le committer)
- [ ] Pas de secret en dur
- [ ] Rapport : routes/types/champs Prisma à ajouter par l'orchestrateur
