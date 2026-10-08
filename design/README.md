# Handoff — Axis Application

Application mobile (iOS + Android) + back-office web pour **Axis**, plateforme de :
- **Convoyage de véhicules en Europe** (à la DriveMee / Hiflow)
- **Import-export de marchandises** (véhicules, motos, palettes, colis) entre la France/Belgique et l'Afrique

3 rôles : **Client** (priorité), **Chauffeur** (Axis + externes), **Admin Ops** (web).

---

## ⚠️ Au sujet des fichiers de design

Les fichiers livrés dans ce bundle sont des **références de design réalisées en HTML/React** (prototypes statiques montrant l'apparence et les comportements visés). **Ce ne sont pas du code de production à copier-coller tel quel.**

La tâche du dev est de **recréer ces designs dans l'environnement cible** — React Native / Flutter / SwiftUI pour le mobile, React/Next.js pour l'admin web — en utilisant les patterns et bibliothèques déjà en place dans le codebase. Si aucun codebase n'existe encore, choisir la stack la plus adaptée et y porter les designs.

Le HTML sert de spec visuelle ; tous les tokens, layouts, typographies, copy et interactions y sont. Les fichiers `.jsx` peuvent être lus comme pseudo-code pour comprendre la structure des composants.

---

## Fidélité

**Hi-fi** — Maquettes pixel-perfect avec couleurs, typographie, espacements et interactions finalisés. Le dev doit recréer l'UI au pixel près en utilisant les bibliothèques et patterns existants du codebase.

---

## Stack du prototype

| Élément | Outil |
|---|---|
| Rendu | React 18 + Babel standalone, JSX dans le navigateur |
| Police | **Manrope** (Google Fonts), 400/500/600/700 |
| Icônes | SVG inline 24×24, trait 1.5–1.8 px (set custom dans `tokens.jsx`) |
| Frames iOS | `ios-frame.jsx` — composant prêt à l'emploi |
| Chrome desktop | `browser-window.jsx` — pour la vue admin |
| Canvas | `components/design-canvas.jsx` — wrapper pan/zoom |

Le point d'entrée est **`Axis App.html`** qui charge tous les `.jsx` dans l'ordre.

---

## Écrans livrés

### App Client (priorité — 10 écrans)
1. **Onboarding / Bienvenue** — logo + tagline + CTA Client / CTA Chauffeur
2. **Accueil** — mission active hero, raccourcis, mission Afrique, aperçu actualités
3. **Nouvelle demande — type de service** — 4 cartes (voiture, moto, colis, marchandise)
4. **Nouvelle demande — détails** — formulaire trajet + véhicule + photos
5. **Devis automatique (convoyage voiture)** — calcul instantané, options Express / Premium
6. **Devis colis Europe → Afrique** — calcul au kg, démarches douanières incluses, disclaimer ±8 %
7. **Suivi temps réel** — map stylisée, timeline, ETA, contact chauffeur
8. **Documents & factures** — filtres, signature en attente, liste docs
9. **Messagerie chauffeur** — bulles, photos, réponses rapides
10. **Actualités transport** — feed Europe / Afrique / réglementation

### App Chauffeur (3 écrans)
1. **Missions** — header navy, stats, mission en cours, tabs (Disponibles / En attente / Historique), liste avec rémunération
2. **État des lieux guidé** — viseur caméra simulé, 8 angles photo, jauges (km / carburant), formulaire dégâts
3. **Contrat & signature** — preview PDF + pad de signature électronique

### Admin Web (1 vue)
1. **Tableau de bord** — sidebar navy, KPIs (4), carte temps réel Europe/Afrique, alertes, courbe 7j, table missions

---

## Système visuel

### Design tokens (`tokens.jsx`)

#### Couleurs — Mode clair (`AXIS_LIGHT`)
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#F5F1E8` | Fond ivoire principal |
| `bgSoft` | `#EDE7D6` | Fond secondaire / pressé |
| `surface` | `#FFFFFF` | Cards |
| `surface2` | `#FAF7EE` | Cards alternatives |
| `ink` | `#0B1A2F` | Texte principal |
| `inkSoft` | `#324358` | Texte secondaire |
| `muted` | `#6E7891` | Texte tertiaire / labels |
| `faint` | `#9CA3B3` | Placeholders |
| `line` | `#E4DCC6` | Bordures cards |
| `lineSoft` | `#EEE6D0` | Séparateurs intérieurs |
| `navy` | `#0B2545` | Bleu marine primaire (CTAs, branding) |
| `navyDeep` | `#06182E` | Bleu marine fond |
| `gold` | `#C9A55C` | Or primaire (logo, accents premium) |
| `goldHi` | `#F2D789` | Or clair (highlights) |
| `goldDeep` | `#8E6A22` | Or foncé (texte sur fond clair) |
| `good` | `#1F8A5B` | Succès |
| `warn` | `#B7791F` | Avertissement |
| `bad` | `#B23A48` | Erreur |
| `select` | `#0B2545` | Couleur d'élément actif (= `navy` en clair) |
| `selectInk` | `#F5F1E8` | Texte sur élément actif |

#### Couleurs — Mode sombre (`AXIS_DARK`)
- `bg: #06182E`, `surface: #0F2B4D`, `surface2: #13345C`
- `ink: #F1ECDC`, `inkSoft: #C7CFDE`
- `gold: #D4B262`, `goldHi: #F2D789`
- **`select: #D4B262`** (or) — c'est le point clé : en sombre la sélection passe en or pour rester visible. Affecte tab bar, cards sélectionnées, vignettes actives.

#### Typographie
- **Famille unique** : `Manrope`, fallback `-apple-system, system-ui, sans-serif`
- **Poids** : 400 (corps), 500 (labels), 600 (boutons, titres section), 700 (titres display, chiffres)
- **Tailles courantes** :
  - Display hero : 46 px / poids 700 / letter-spacing -0.02em
  - Display M : 28 px / 700 / -0.01em
  - Display S : 22-24 px / 700
  - Titre card : 14-15 px / 600
  - Body : 13-14 px / 400
  - Label uppercase : 10.5-11.5 px / 600 / letter-spacing .06em / `muted`
  - Chiffres : `fontVariantNumeric: 'tabular-nums'`

#### Espacements / radii / ombres
- **Border-radius** : 8 (petit), 10 (boutons), 12 (cards), 14-16 (surfaces), 999 (pills)
- **Padding cards** : 14-18 px
- **Gap entre cards** : 10-14 px
- **Shadow standard** : `0 1px 2px rgba(11,37,69,.05), 0 6px 24px rgba(11,37,69,.06)`
- **Shadow large** : `0 8px 28px rgba(11,37,69,.10), 0 2px 6px rgba(11,37,69,.06)`

### Primitives UI (`tokens.jsx`)

Toutes définies dans `tokens.jsx`, prêtes à porter dans le codebase cible :
- `<Surface>` — card
- `<Pill tone>` — tag/badge (tones : default, gold, navy, good, warn, bad, ghost)
- `<Button kind size>` — kinds : primary (navy), gold, outline, ghost, danger
- `<Avatar name size tone>` — initiales sur fond navy / gold
- `<Field label value icon>` — input "faux" (visuel uniquement)
- `<SectionHead title action>` — titre de section uppercase
- `<TabBar items active>` — barre du bas mobile — **actif utilise `t.select`** (navy clair, or sombre)
- `<AppBar title onBack>` — header iOS avec safe-area
- `<StatusBadge status>` — pill de statut mission
- `<RouteMap from to progress>` — map SVG stylisée Europe/Afrique
- `<AxisLogo size>`, `<AxisMark size>` — logo PNG transparent

### Icônes (`I` dans `tokens.jsx`)

Set complet en SVG inline : home, truck, doc, chat, bell, plus, arrow, arrowL, chev, car, bike, box, pallet, pin, map, camera, edit, check, x, sig, shield, search, filter, globe, star, euro, fuel, speedo, user, users, lock, mail, phone, calendar, card, news, warn, bolt, flag, upload, download, print, refresh, trash, more, sliders.

Usage : `{I.home({ size: 22, stroke: 1.6 })}`.

---

## Patterns de layout

### Mobile (iPhone 402×874 / Android équivalent)
- Safe area top = **62 px** (status bar iOS) — toutes les pages commencent leur padding à 62 px
- Tab bar mobile = **8 px top + 28 px bottom** (home indicator)
- Cards : padding 16, gap 10-14
- Boutons CTA bas de page : sticky en bas, padding 12 top / 24 bottom, fond `surface` avec `border-top: 1px solid line`

### Web admin
- Sidebar fixe **224 px**, fond `navyDeep`, items avec barre dorée à gauche quand actif
- Contenu : padding 24 32, gap 20
- Grille KPI : 4 colonnes égales, gap 14
- Grille principale : `1.65fr 1fr` (carte / colonne droite alertes+chart)

---

## Interactions & comportements clés

### Navigation mobile
- 5 onglets bottom tab bar côté Client : Accueil, Suivi, **Demander** (CTA central), Documents, Messages
- 5 onglets côté Chauffeur : Missions, États lieux, Contrats, Messages, Profil
- Bouton "sliders" en haut à gauche de l'Accueil → ouvre le **drawer menu principal** (slide-in 84% width, backdrop blur, sections Compte / Activité / Axis / Préférences)

### Devis automatique
- Étapes : `type` → `form` → `quote` → confirmation
- Le devis se calcule en local à partir d'un modèle par service :
  - **Convoyage Europe** : `base + km × tarif/km` — affiché "Devis instantané"
  - **Import-export Afrique** : `base + (kg/palettes) × tarif/unité` — affiché "Devis estimé ±8 %" avec disclaimer
- 2 options : Express (+22 %, livraison 24h), Assurance Premium (+35 €, plafond 500 k€)
- CTA : Sauvegarder / Réserver / Parler à un conseiller

### État des lieux (chauffeur)
- 8 angles photo guidés (avant, arrière, côté G, côté D, tableau de bord, compteur, carburant, coffre)
- Viseur caméra simulé avec coins en or, silhouette véhicule fantôme
- Bouton capture central (Ø 70 px, or), navigation ◀ ▶
- Strip de vignettes en bas avec état (à faire / actif / fait)
- Champ relevé km + carburant + dégâts apparents (textarea)
- À 8/8 → CTA "Générer le contrat" devient actif

### Contrat & signature
- Preview "fausse page PDF" avec header Axis, parties, trajet, état des lieux miniatures, zone signatures
- Pad de signature : tap pour signer (placeholder visuel = courbe SVG), tap pour effacer
- Bouton "Valider & envoyer" disabled tant que `!signed`

### Suivi temps réel
- Map SVG stylisée Europe/Afrique (`<RouteMap>`)
- Timeline verticale 5 étapes (Demandé → État lieux → En route → État arrivée → Livré)
- Cards contact chauffeur avec boutons Appeler / Messages
- MAJ "il y a 12 s" (animation possible)

### Tweaks (panneau de debug)
Le panneau `tweaks-panel.jsx` permet de basculer light/dark à la volée — **à retirer en prod**, c'est un outil de présentation seulement.

---

## State management (à recréer côté codebase cible)

### Client app
```ts
type Route = 'onboarding' | 'home' | 'new' | 'newForm' | 'quote'
            | 'track' | 'docs' | 'msg' | 'news';
type Draft = { service: 'car' | 'moto' | 'colis' | 'merch' };

{ route, setRoute }
{ draft, setDraft }
{ menuOpen, setMenuOpen }
{ dark, setDark }
```

### Driver app
```ts
type Route = 'home' | 'etat' | 'contract';
{ route, setRoute }
{ angleStep, setAngleStep }    // 0..7
{ signed, setSigned }
```

### Données serveur attendues
- **Missions** (ref, service, vehicle, from, to, status, driver, eta, distance, remaining, progress, picked)
- **Drivers** (id, name, avatar, rating, missionsCount, level, available)
- **Documents** (id, type, title, ref, date, size, status)
- **News articles** (id, category, title, summary, body, date, readTime, tag)
- **Quotes** (id, service, from, to, distance/weight, basePrice, kmPrice, addons[], total)

### API à prévoir (à confirmer avec le backend)
- `POST /quotes` — calculer un devis (server-side pour cohérence pricing)
- `POST /missions` — créer une mission
- `GET /missions/:id` + WebSocket pour le suivi temps réel
- `POST /missions/:id/inspection` — upload photos + relevés état des lieux
- `POST /missions/:id/contract/sign` — signature électronique
- `GET /news` — feed actualités
- `POST /messages/:thread` — messagerie

---

## Assets

| Fichier | Source | Note |
|---|---|---|
| `assets/axis-mark.png` | Original `uploads/logo.png` retraité | 604×604, recoloration sur `#C9A55C` (gold du thème), bords anti-aliasés préservés. Transparent. |
| `assets/axis-mark-original.png` | Upload original utilisateur | Référence brute non retouchée. |

**Le logo final est `axis-mark.png`**. Il doit rester en transparent (pas de carré navy autour). Idéalement, demander au designer une version **SVG vectorielle officielle** pour une netteté parfaite à toutes les tailles — le PNG actuel est satisfaisant mais a un léger anti-aliasing en très petite taille.

---

## Internationalisation

Tout le copy est en **français**. Le ton est **tutoiement, pro et direct** (cf. "Que veux-tu transporter ?", "Bon retour, Marc", "Tarif spécifique ? Parle à un conseiller"). À conserver dans la traduction.

Format chiffres :
- Devise : `1 240,00 €` (espace insécable, virgule)
- Distances : `312 km`, `48 217 km`
- Heures : `14h32` (mode condensé), `11:08` (mode timeline)
- Dates : `22 mai 2026`, `Lun. 24/05`

---

## Fichiers du bundle

```
design_handoff_axis_app/
├── README.md                      ← ce fichier
├── Axis App.html                  ← point d'entrée du prototype (à ouvrir dans le navigateur)
├── tokens.jsx                     ← design system : couleurs, typo, primitives, logo, icônes
├── client.jsx                     ← App client (10 écrans)
├── client-menu.jsx                ← Drawer menu principal (Compte/Activité/Axis/Préférences)
├── driver.jsx                     ← App chauffeur (3 écrans)
├── admin.jsx                      ← Dashboard admin web
├── app.jsx                        ← Assemblage canvas + tweaks
├── ios-frame.jsx                  ← Composant frame iPhone (iOS 26)
├── browser-window.jsx             ← Chrome desktop pour l'admin
├── tweaks-panel.jsx               ← Panneau debug light/dark
├── components/
│   └── design-canvas.jsx          ← Wrapper canvas pan/zoom (présentation uniquement)
└── assets/
    ├── axis-mark.png              ← Logo Axis (or #C9A55C, transparent)
    └── axis-mark-original.png     ← Référence logo brute
```

Pour visualiser : ouvrir `Axis App.html` dans un navigateur Chrome récent — tous les artboards s'affichent en pan/zoom à la Figma. Cliquer sur l'icône d'expansion d'un artboard pour le voir en plein écran.

---

## Recommandations d'implémentation

1. **Mobile** : React Native ou Flutter. Les composants `<Surface>`, `<Pill>`, `<Button>`, etc. doivent être recréés selon la stack. Le frame iOS du prototype n'est qu'un emballage visuel — la vraie app utilisera les natives.
2. **Map temps réel** : intégrer **Mapbox** ou **Google Maps** à la place du SVG stylisé du prototype. Style "monochrome ivoire / navy" pour rester dans la palette.
3. **Signature électronique** : intégrer `react-native-signature-canvas` ou équivalent ; le contrat PDF doit être généré server-side via **PDFKit / Puppeteer**.
4. **Photos état des lieux** : compression côté client (max ~1500 px largeur), upload progressif, EXIF stripping.
5. **Temps réel** : WebSocket / Pusher pour suivi GPS + messagerie. Polling fallback toutes les 30 s.
6. **Devis** : la logique côté client du prototype est illustrative — déplacer le calcul **côté serveur** pour cohérence pricing et historique.
7. **Notifications push** : Firebase Cloud Messaging — étapes clés : chauffeur en route, X min avant arrivée, contrat à signer, document douanier requis.
8. **Le logo** : remplacer le PNG actuel par un **SVG vectoriel** dès qu'une version officielle est disponible.

---

Pour toute question sur l'intention design, se référer aux fichiers `.jsx` (commentés) et au prototype HTML interactif.
