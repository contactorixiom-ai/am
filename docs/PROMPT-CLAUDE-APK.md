# Script à coller dans Claude (version web) — construire l'application native Axis Import

Copie tout ce qui se trouve sous la ligne, colle-le dans une nouvelle
conversation sur claude.ai, puis suis ses questions une par une. Claude te
guidera commande par commande, et saura quoi faire quand une étape échoue.

---

Je m'appelle Ahmed. Je gère l'application **Axis Import** (convoyage de
véhicules). Elle est écrite en React Native avec **Expo SDK 54**, et existe
déjà en version web sur https://app-axisimport.com. Je veux maintenant une
**vraie application installée** sur les téléphones des convoyeurs
(Android d'abord, iPhone ensuite), parce que le suivi GPS en temps réel doit
continuer **écran verrouillé et en arrière-plan**, ce qu'un navigateur
n'autorise pas.

Je ne suis pas développeur : explique chaque commande, dis-moi exactement où
la taper, ce que je dois voir à l'écran, et attends ma réponse avant de passer
à l'étape suivante. Quand quelque chose échoue, je te colle le message
d'erreur et tu me dis quoi faire.

## Ce qui est déjà prêt dans le projet (ne pas refaire)

Le dépôt GitHub est `contactorixiom-ai/am`, l'application est dans le dossier
`mobile`. Tout le travail technique est fait :

- `mobile/app.json` : nom « Axis Import », identifiant `com.axisimport.app`
  (Android et iOS), permissions de localisation en arrière-plan
  (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`,
  `UIBackgroundModes: location`), textes d'autorisation en français, plugin
  `expo-location` avec `isAndroidBackgroundLocationEnabled` et
  `isAndroidForegroundServiceEnabled`.
- Le suivi GPS en tâche de fond est codé (`expo-task-manager`, tâche
  `axis-convoy-location`) : il démarre quand le convoyeur appuie sur
  « Démarrer le suivi » dans le mode chauffeur, et s'arrête à la livraison.
  Une notification « Convoyage en cours » reste affichée pendant le suivi
  (obligatoire sur Android).
- `mobile/eas.json` : trois profils de build — `development` (client de
  développement), `preview` (APK Android à distribuer par lien, iOS pour
  TestFlight), `production` (AAB pour le Play Store, archive pour l'App
  Store). Tous pointent vers l'API de production
  `https://am-production-80d6.up.railway.app/api/v1`.
- Scripts npm dans `mobile/package.json` : `npm run build:apk` (APK preview),
  `npm run build:devclient` (client de développement), `npm run check:native`
  (vérifie la configuration native sans lancer de build).
- Le compte Expo prévu est `am27zz`, équipe `am27zzs-team` (ligne `"owner"`
  de `app.json`). Si j'utilise un autre compte, il faut changer cette ligne.
- Un workflow GitHub Actions « Construire l'APK Android » existe aussi : il
  produit un APK signé avec la clé de débogage, sans aucun compte Expo, en
  dix minutes, téléchargeable dans l'onglet Actions du dépôt (artefact
  `axis-import-apk`). Il suffit pour la bêta, pas pour le Play Store.
- Le keystore Android de publication et ses mots de passe sont dans un
  dossier local `cles-android-NE-PAS-PARTAGER/` (jamais dans Git). Il ne faut
  jamais les coller dans une conversation ni les committer.
- Un serveur et une base de données tournent déjà sur Railway ; rien à faire
  côté serveur. Les secrets (Stripe, Firebase, clés) sont des variables
  Railway, jamais dans le code.

## Point important : Expo Go ne suffit pas

Expo Go (l'appli de l'App Store / Play Store) sert à parcourir l'application,
mais **ne peut pas exécuter le suivi GPS en arrière-plan**, ni sur Android ni
sur iOS. Pour tester et distribuer le GPS réel il faut une **build native**
(APK ou client de développement). Ne me propose donc pas Expo Go pour cette
fonction.

## Ce que je veux obtenir, dans l'ordre

1. **Android, tout de suite** : un fichier APK que j'envoie par WhatsApp aux
   convoyeurs, avec le GPS en arrière-plan fonctionnel. Deux chemins
   possibles : le workflow GitHub (sans compte) ou `eas build` (compte Expo
   gratuit). Aide-moi à choisir et guide-moi.
2. **Tester le GPS** : m'expliquer comment vérifier sur un téléphone que la
   position continue d'être envoyée écran verrouillé (choisir « Toujours
   autoriser » à la demande d'autorisation, vérifier la notification
   « Convoyage en cours », regarder la carte côté client sur
   https://app-axisimport.com).
3. **Mises à jour sans refaire d'APK** : m'expliquer `eas update --branch
   preview` pour pousser les corrections JavaScript.
4. **iPhone** : ce qu'il faut (compte Apple Developer à 99 $/an, App Store
   Connect, TestFlight), puis `eas build --platform ios --profile preview` et
   `eas submit --platform ios --latest`, et comment inviter les testeurs.
5. **Les stores** : Google Play (compte à 25 $, build `production` en AAB,
   signature avec mon keystore, formulaire de déclaration pour la
   localisation en arrière-plan avec une courte vidéo montrant le mode
   chauffeur) et App Store (fiche, captures, revue).

## Mon environnement

- Ordinateur : [Windows / Mac — à préciser]
- Node.js installé : [oui / non / je ne sais pas]
- Git installé et dépôt cloné : [oui / non]
- Compte Expo : [oui, identifiant … / non]
- Compte Google Play Console : [oui / non]
- Compte Apple Developer : [oui / non]

Commence par vérifier ces prérequis avec moi (une question à la fois), puis
lance-moi sur l'étape 1.

## Règles à respecter

- Ne modifie jamais `.github/workflows` sans me le dire explicitement.
- Ne jamais coller ni demander les mots de passe du keystore, les clés
  Stripe ou Firebase.
- Les textes destinés aux convoyeurs et aux clients sont en français.
- Quand tu me donnes une commande, indique le dossier (`mobile`) et le
  résultat attendu.
