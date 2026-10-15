# Publier Axis Import sur Google Play

Le compte développeur Google Play est vérifié au nom de **AXIS IMPORT**
(D-U-N-S 285506410). C'est un compte **organisation** : la règle des
« 12 testeurs pendant 14 jours », imposée aux comptes personnels récents, ne
s'applique pas. L'application peut passer en production dès la validation
de Google.

Ce guide suit l'ordre de la Play Console. Les textes et les visuels sont
prêts : il suffit de les copier.

---

## 0. Avant de commencer

1. **Pages légales** : identité de la société, siège, SIRET, RCS, TVA et
   directeur de la publication sont renseignés ; la politique de
   confidentialité et la page de support n'ont plus de bandeau « À compléter ».
   Restent dans les CGU : téléphone et médiateur de la consommation.
2. **Mettre en ligne la dernière version** du serveur sur Railway.
3. **Préparer deux comptes de test** sur l'application en ligne, pour
   l'équipe de vérification de Google :
   - un compte **client** (e-mail + mot de passe) ;
   - un compte **convoyeur**, avec des pièces validées par Roger et une
     mission de test qui lui est affectée.

---

## 1. Construire l'application (fichier .aab)

Google Play n'accepte que le format **AAB**. Le profil `production` de
`mobile/eas.json` le produit.

La construction est automatique : chaque envoi sur la branche
`claude/axis-import-platform-mo86xr` lance, chez Expo, l'APK de test et l'AAB
de production (`mobile/.eas/workflows/apk-test.yml`). On peut aussi la lancer
à la main : expo.dev → projet axis-import → **Compiler à partir de GitHub** →
branche `claude/axis-import-platform-mo86xr`, Android, profil `production`.

- La clé de signature est enregistrée chez Expo (Credentials → Android) ;
  ne jamais la supprimer, elle sert à toutes les mises à jour.
- Le numéro de version (`versionCode`) augmente tout seul à chaque build.
- À la fin : expo.dev → Constructions → la build « production » →
  **Télécharger** le fichier `.aab`.

La toute première fois, le fichier s'envoie **à la main** dans la Play
Console (étape 5).

---

## 2. Créer l'application dans la Play Console

*Toutes les applications → Créer une application*

| Champ | Valeur |
|---|---|
| Nom de l'application | `Axis Import` |
| Langue par défaut | Français (France) – fr-FR |
| Application ou jeu | Application |
| Gratuite ou payante | Gratuite |

Cocher les deux déclarations (règles du programme, lois américaines à
l'exportation).

---

## 3. « Configurer votre application » (Contenu de l'application)

### Règles de confidentialité
URL : `https://contactorixiom-ai.github.io/am/confidentialite.html`

### Accès à l'application
« Tout ou partie des fonctionnalités sont soumises à restriction » → ajouter
les identifiants :

> Compte client : `<e-mail>` / `<mot de passe>`
> Compte convoyeur : `<e-mail>` / `<mot de passe>`
> Le mode chauffeur se trouve dans l'onglet Missions du compte convoyeur.
> « Démarrer le suivi » affiche l'explication sur la localisation, puis la
> demande d'autorisation du système.

### Annonces
Non, l'application ne contient pas d'annonces.

### Classification du contenu
Catégorie : **Toutes les autres applications** (pas un jeu). Répondre
**Non** à toutes les questions sur la violence, la sexualité, le langage,
les substances, les jeux d'argent. Ensuite :

| Question | Réponse |
|---|---|
| Les utilisateurs peuvent-ils interagir ou échanger du contenu ? | **Oui** (messagerie avec Axis et le convoyeur) |
| L'application partage-t-elle la position actuelle de l'utilisateur avec d'autres utilisateurs ? | **Oui** (position du convoyeur visible par le client pendant la mission) |
| Achats de biens numériques ? | Non (les paiements concernent des services de transport) |
| Accès libre à Internet (navigateur) ? | Non |

### Public cible
**18 ans et plus** uniquement. L'application n'est pas destinée aux enfants.

### Applications d'actualités
Non.

### Sécurité des données

**Collecte et partage**

- L'application collecte-t-elle des données ? **Oui**.
- Les données sont-elles chiffrées en transit ? **Oui** (HTTPS).
- Les utilisateurs peuvent-ils demander la suppression ? **Oui**.
- URL de suppression du compte :
  `https://contactorixiom-ai.github.io/am/suppression-compte.html`
- Partage avec des tiers : **non**. Stripe (paiement) et Railway
  (hébergement) agissent pour le compte d'Axis : Google les classe comme
  prestataires, ce n'est pas un partage. La position transmise au client est
  lancée par le convoyeur lui-même, après son accord explicite.

**Types de données à déclarer** (toutes collectées, non partagées) :

| Catégorie Play Console | Type | Pourquoi | Facultatif ? |
|---|---|---|---|
| Position | Position exacte | Fonctionnalité de l'application (suivi du convoyage) | Oui (convoyeurs, pendant une mission) |
| Position | Position approximative | Fonctionnalité de l'application | Oui |
| Informations personnelles | Nom | Fonctionnalité, gestion du compte | Non |
| Informations personnelles | Adresse e-mail | Fonctionnalité, gestion du compte | Non |
| Informations personnelles | Numéro de téléphone | Fonctionnalité (contact pour le transport) | Non |
| Informations personnelles | Adresse | Fonctionnalité (enlèvement, livraison, facturation) | Non |
| Informations personnelles | Autres informations | Comptes pro (SIRET, TVA) ; pièces d'identité des convoyeurs (prévention de la fraude) | Oui |
| Informations financières | Historique des achats | Fonctionnalité (commandes, factures) | Non |
| Messages | Autres messages dans l'application | Fonctionnalité (messagerie) | Oui |
| Photos et vidéos | Photos | Fonctionnalité (état des lieux, pièces du convoyeur) | Oui |
| Fichiers et documents | Fichiers et documents | Fonctionnalité (pièces du convoyeur) | Oui |
| Activité dans l'application | Autre contenu généré par l'utilisateur | Fonctionnalité (signatures, descriptions d'envoi) | Non |
| Identifiants de l'appareil ou autres | ID de l'appareil ou autres ID | Fonctionnalité (notifications) | Oui |

Les numéros de carte ne sont **pas** collectés : la saisie se fait sur la
page de Stripe.

### Autorisations sensibles — localisation en arrière-plan

*Contenu de l'application → Autorisations liées à la position*

- **Fonctionnalité** : suivi en temps réel du convoyage. Le client suit son
  véhicule pendant que le convoyeur conduit, téléphone verrouillé.
- **Texte à coller** :

> Axis Import met en relation des clients et des convoyeurs qui conduisent
> leur véhicule d'une ville à une autre. Pendant une mission lancée par le
> convoyeur lui-même (« Démarrer le suivi »), l'application transmet sa
> position toutes les 15 secondes environ, y compris écran verrouillé, pour
> que le client suive son véhicule et qu'Axis puisse porter assistance en cas
> d'arrêt prolongé. Le convoyeur conduit : son téléphone est verrouillé
> pendant presque tout le trajet, d'où l'accès en arrière-plan. Le partage
> s'arrête à la livraison ou quand le convoyeur l'arrête ; hors mission,
> aucune position n'est relevée. Une explication s'affiche avant la demande
> d'autorisation, et une notification permanente « Convoyage en cours »
> reste visible pendant le partage.

- **Vidéo** (lien YouTube non répertorié, 30 à 60 secondes), filmée sur un
  téléphone Android avec la version de test interne :
  1. compte convoyeur → onglet Missions → « Démarrer le suivi » ;
  2. l'écran d'explication s'affiche → « J'accepte » ;
  3. la demande d'Android → « Toujours autoriser » ;
  4. la notification « Convoyage en cours » ; verrouiller le téléphone ;
  5. sur un autre téléphone, compte client → Suivi : la position avance.

### Autorisations de service de premier plan

*Contenu de l'application → Service de premier plan* : cocher
**Localisation**, coller le même texte et la même vidéo.

---

## 4. Fiche du Play Store

*Croissance → Présence sur le Play Store → Fiche principale*

**Nom** (30 max) : `Axis Import`

**Description courte** (80 max) :

```
Convoyage de véhicules en Europe, colis et marchandises vers l'Afrique.
```

**Description complète** :

```
Axis Import organise le convoyage de véhicules en Europe et l'envoi de colis et de marchandises entre la France et l'Afrique subsaharienne. Devis, paiement, suivi et documents : tout se fait depuis l'application.

CONVOYAGE DE VÉHICULES
• Devis immédiat selon la distance routière réelle et la catégorie du véhicule (citadine, SUV, utilitaire, moto…)
• Un convoyeur dont l'identité et le permis ont été vérifiés par Axis
• Position du convoyeur en temps réel pendant le trajet
• État des lieux au départ et à l'arrivée : photos guidées, croquis du véhicule, dommages repérés, signatures du client et du convoyeur
• Contrat et procès-verbaux en PDF, signés depuis le téléphone

COLIS ET MARCHANDISES VERS L'AFRIQUE
• Maritime : fûts, cartons, valises, électroménager, au m³ ou à la palette
• Aérien express au kilo
• Prix de la grille Axis affiché avant de commander
• Suivi de l'envoi étape par étape, jusqu'à la remise au destinataire
• Documents de douane préparés par Axis

PAIEMENT SÉCURISÉ
• Carte bancaire ou Google Pay sur la page sécurisée de Stripe : Axis Import ne voit jamais votre numéro de carte
• Facture disponible dans l'application

POUR LES PROFESSIONNELS
• Compte entreprise (SIRET, TVA), factures à votre raison sociale
• Tous vos convoyages et envois au même endroit

POUR LES CONVOYEURS
• Missions affectées par Axis, adresses et contacts en un coup d'œil
• Mode chauffeur : partage de position pendant la mission uniquement, alerte en cas d'arrêt prolongé
• État des lieux guidé : aucune photo oubliée

Une question ? Écrivez à Axis depuis l'application (Profil → Contacter Axis) ou à contact@axisimport.fr.
```

**Visuels** (dossier `docs/play-store/`) :

| Élément | Fichier |
|---|---|
| Icône 512 × 512 | `icone-512.png` |
| Image de présentation 1024 × 500 | `banniere-1024x500.png` |
| Captures téléphone 1080 × 1920 (7) | `captures/01-accueil.png` … `07-tarifs.png` |

**Catégorie** : Entreprise. **Coordonnées** : e-mail
`contact@axisimport.fr` (obligatoire), site web
`https://contactorixiom-ai.github.io/am/` (facultatif).

---

## 5. Test interne, puis production

1. *Tester → Tests internes → Créer une version* : déposer le fichier
   `.aab`, notes de version :
   ```
   Première version : devis et paiement en ligne, suivi en direct, états des lieux et documents signés, grille tarifaire import-export.
   ```
2. Ajouter les adresses Gmail de Roger et des convoyeurs comme testeurs,
   leur envoyer le lien d'installation.
3. Vérifier sur un vrai téléphone : connexion, devis, paiement, mode
   chauffeur (explication puis « Toujours autoriser »), carte, photos de
   l'état des lieux. Filmer la vidéo de localisation à ce moment-là.
4. *Production → Créer une version* : reprendre la même version, envoyer en
   examen. Comptez quelques jours ; l'examen peut être plus long à cause de
   la localisation en arrière-plan.

Mises à jour ensuite : `eas build --platform android --profile production`,
puis une nouvelle version en production (ou `eas submit`).

---

## Et les iPhone ?

Un **APK ne s'installe pas sur iPhone** : c'est le format d'Android
uniquement. Deux voies :

- **Tout de suite** : l'application web, déjà en ligne. Sur iPhone, l'ouvrir
  dans **Safari → Partager → « Sur l'écran d'accueil »** : elle s'installe
  avec son icône et s'ouvre en plein écran. Devis, paiement, suivi,
  documents et signatures fonctionnent. Limite pour les convoyeurs sur
  iPhone : le suivi GPS demande de garder l'application ouverte, écran
  allumé.
- **Ensuite** : l'App Store. Il faut le compte Apple Developer en tant
  qu'organisation (99 €/an). Le numéro D-U-N-S 285506410 sert aussi chez
  Apple : le nom saisi doit être exactement « AXIS IMPORT ». Puis TestFlight
  (bêta par lien), puis la publication. Voir `docs/APP-STORE.md`.
