# Construire la vraie application Axis Import

Ce guide transforme le lien web en **application installable** : un APK à
envoyer par WhatsApp aux convoyeurs, puis une mise en ligne sur les stores.

C'est ce qui débloque le **suivi GPS en arrière-plan** : sur le web, la
position s'arrête dès que le convoyeur verrouille son écran. Dans
l'application installée, elle continue pendant tout le trajet.

---

## Ce qui est déjà prêt dans le dépôt

| Fichier | Rôle |
|---|---|
| `mobile/eas.json` | Les trois profils de build (development, preview, production) |
| `mobile/app.json` | Identifiants, icône, permissions Android et textes iOS |
| `mobile/assets/icon.png` | Icône 1024×1024 sans transparence, exigée par App Store Connect |
| `mobile/assets/adaptive-icon.png` | Icône Android, logo dans la zone sûre du masque circulaire |
| `mobile/src/utils/backgroundLocation.native.ts` | La tâche système qui transmet la position écran verrouillé |
| `mobile/src/utils/nativeLocation.ts` | Le suivi au premier plan, qui alimente l'affichage |

Les projets natifs (`android/` et `ios/`) ne sont pas versionnés : EAS les
régénère à chaque build depuis `app.json`. La configuration a été validée
localement avec `npx expo prebuild` — permissions Android et clés Info.plist
correctes sur les deux plateformes.

Identifiants de l'application :
- Android : `com.axisimport.app`
- iOS : `com.axisimport.app`
- Compte Expo : `am27z`, projet `axis-import`

---

## 1. Une seule fois : se connecter

```bash
npm install -g eas-cli
cd mobile
eas login          # compte am27z
eas build:configure
```

`eas build:configure` crée le projet côté Expo et écrit son identifiant dans
`app.json`. C'est la seule commande qui modifie le dépôt — pense à
committer le changement.

---

## 2. Android — l'APK à distribuer tout de suite

C'est le chemin le plus court : aucun compte payant, aucune validation.

```bash
cd mobile
eas build --platform android --profile preview
```

Compte 15 à 25 minutes. À la fin, EAS affiche un lien de téléchargement et
un QR code. Le convoyeur ouvre le lien sur son téléphone, installe l'APK
(Android demandera d'autoriser les « sources inconnues »), et c'est tout.

**À l'installation, le convoyeur doit accepter la localisation en
choisissant « Toujours autoriser ».** Sans cela, le suivi s'arrêtera à
chaque fois qu'il verrouille son téléphone — l'app le lui signale.

Une fois le suivi lancé, Android affiche en permanence une notification
« Convoyage en cours ». Elle est imposée par le système pour tout service de
localisation, et c'est aussi ce qui garantit au convoyeur qu'il sait quand
sa position est partagée.

---

## 3. iOS — TestFlight

Nécessite un **compte Apple Developer** (99 $/an). Sans lui, aucun moyen
d'installer sur iPhone : c'est une contrainte d'Apple, pas du projet.

```bash
cd mobile
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

Une fois la build envoyée, invite les testeurs depuis App Store Connect. Ils
reçoivent un e-mail et installent via TestFlight.

---

## 4. Mise en ligne sur les stores

```bash
# Google Play — compte développeur à 25 $, paiement unique
eas build --platform android --profile production
eas submit --platform android --latest

# App Store
eas build --platform ios --profile production
eas submit --platform ios --latest
```

Prévoir pour chaque store : une description, au moins quatre captures
d'écran, une icône 512×512, et l'URL d'une politique de confidentialité.

Google Play et Apple demandent tous deux de **justifier la localisation en
arrière-plan**. La réponse est la même dans les deux cas : *l'application
partage la position du convoyeur avec le client propriétaire du véhicule
pendant toute la durée du convoyage, afin qu'il suive son véhicule en temps
réel ; le suivi doit donc continuer lorsque l'écran est verrouillé.*

---

## 5. Corriger un bug sans refaire une build

Pour toute correction qui ne touche pas au code natif :

```bash
cd mobile
eas update --branch preview --message "Correction de l'affectation"
```

Les téléphones reçoivent la mise à jour au redémarrage de l'app, en
quelques secondes. Une nouvelle build n'est nécessaire que si l'on ajoute
un module natif ou si l'on change les permissions.

---

## 6. Vérifier la configuration native sans lancer de build

```bash
cd mobile
npx expo prebuild --platform android --no-install --clean
npx expo prebuild --platform ios --no-install --clean
```

Ces commandes génèrent les projets natifs localement et révèlent toute erreur
de configuration en quelques secondes, au lieu d'attendre vingt minutes une
build qui échoue. Supprimer ensuite `android/` et `ios/` : ils ne sont pas
versionnés.

## 7. Avoir l'app sur le téléphone — et pourquoi pas Expo Go

**Expo Go fonctionne maintenant** : le projet est passé en SDK 54, et c'est
précisément la version que sert l'Expo Go de l'App Store. Installer Expo Go,
lancer `npx expo start` et scanner le QR code suffit pour parcourir
l'application sur son téléphone.

**Une limite demeure** : Expo Go **ne sait pas exécuter le suivi GPS en
arrière-plan**, ni sur iOS ni sur Android. Le mode chauffeur s'ouvre et
s'utilise, mais la position ne continue pas d'être transmise écran
verrouillé. Pour éprouver cette fonction — la plus importante du mode
chauffeur — il faut le **client de développement**, qui offre la même
expérience (QR code, rechargement à chaque modification) avec toutes les
fonctions natives.

### Une fois : construire le client

```bash
cd mobile
npm run build:devclient      # ≈ 20 min, produit un APK à installer
```

### Ensuite : le QR code, à chaque session

```bash
cd mobile
npm run phone
```

Le terminal affiche un QR code. On le scanne avec le client installé, et
l'application se charge — en rechargeant automatiquement à chaque
modification du code. Le tunnel traverse les box et les réseaux d'entreprise :
téléphone et ordinateur n'ont pas besoin d'être sur le même réseau.

### Les trois façons d'avoir l'app, et ce que chacune permet

| | Installation | GPS en arrière-plan | Rechargement à chaud |
|---|---|---|---|
| **Web** (lien actuel) | rien à installer | non | — |
| **Client de développement** | APK à installer une fois | oui | oui |
| **APK preview** | APK à installer | oui | non, refaire une build |

Pour Roger au quotidien : l'**APK preview**. Pour tester une modification en
cours : le **client de développement**.

---

## Ce qui dépend de toi

| Élément | Coût | Sans lui |
|---|---|---|
| Compte Expo `am27z` | gratuit | Aucune build possible |
| Compte Google Play | 25 $ une fois | APK seulement, pas de store |
| Compte Apple Developer | 99 $/an | Aucune installation sur iPhone |
| Clés Stripe dans Railway | gratuit | Les paiements restent en simulation |

Le chemin recommandé pour la bêta : **APK Android + version web**. Aucun
compte payant, aucune validation, et la distribution se fait par un simple
lien.
