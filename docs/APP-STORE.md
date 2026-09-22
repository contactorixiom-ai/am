# Publier Axis Import sur l'App Store

État au 22 septembre 2026.

## La montée de version est faite

Depuis le **28 avril 2026**, Apple refuse toute application qui n'est pas
compilée avec **Xcode 26 et le SDK iOS 26**
([annonce Apple](https://developer.apple.com/news/upcoming-requirements/)).
Le projet était en **Expo SDK 51** (React Native 0.74.5, mi-2024) et ne
pouvait donc pas être soumis.

Il est désormais en **Expo SDK 54** (React Native 0.81.5, React 19). Expo
indique que les projets en SDK 54 ou 55 sont compatibles sans intervention :
l'image de compilation EAS par défaut utilise Xcode 26
([blog Expo](https://expo.dev/blog/app-store-connect-minimum-sdk-26)).

Le SDK 54 plutôt qu'une version plus récente, pour deux raisons :

- c'est la version que sert l'**Expo Go de l'App Store**, donc la seule qui
  permette d'ouvrir l'application depuis l'Expo Go public, sans installer
  quoi que ce soit d'autre ;
- c'est le plus petit saut qui satisfasse Apple, donc le moins risqué à
  quelques jours d'une bêta.

Ce qui a été vérifié ici : compilation TypeScript sans erreur, empaquetage
web et Android réussis, et parcours des trois rôles dans un navigateur sans
plantage. Ce qui **ne peut pas** l'être dans cet environnement : la
compilation native iOS et Android. Le premier `eas build` reste l'étape de
vérité.

## Ce qui est déjà en place

- Identifiant d'application `com.axisimport.app`, version 1.0.0.
- Modes d'arrière-plan iOS déclarés (localisation, notifications).
- Textes d'autorisation en français, explicites sur l'usage — Apple les lit.
- `ITSAppUsesNonExemptEncryption: false` : correct, l'application n'utilise
  que HTTPS.
- Icônes 1024×1024 sans transparence.
- **Suppression du compte depuis l'application** (règle 5.1.1(v)) : ajoutée.
  Sans elle, le refus était certain.

## Ce qu'il reste à faire

### 1. Compte développeur Apple — à lancer en premier

99 € par an. Pour une inscription **au nom de la société**, Apple exige un
**numéro D-U-N-S**, gratuit mais avec un délai d'obtention de l'ordre de deux
semaines. C'est le point à démarrer maintenant : tout le reste peut se faire
en parallèle, celui-là bloque.

Pas besoin de Mac : EAS Build compile sur des machines Apple chez Expo.

### 2. Pages légales publiques

- **Politique de confidentialité** : l'URL est obligatoire dans App Store
  Connect. Doit couvrir la géolocalisation en arrière-plan, les photos, les
  pièces d'identité KYC et la durée de conservation.
- **Conditions générales** et une **page de support** avec une adresse de
  contact réelle.

### 3. Questionnaire « confidentialité » d'App Store Connect

À déclarer honnêtement : position précise et en arrière-plan, coordonnées,
photos, identifiants, données d'usage. Toute omission découverte vaut un
retrait.

### 4. Compte de démonstration pour la revue

La connexion est obligatoire dans l'application : Apple exige donc un compte
de test. Il en faut **deux** : un client et un convoyeur avec une mission
affectée, sinon le testeur ne voit pas le suivi GPS.

### 5. Justifier la localisation en arrière-plan

C'est le point le plus scruté. Dans les notes de revue, expliquer que le
convoyeur partage sa position pendant un convoyage pour que le client suive
son véhicule, que le suivi ne démarre qu'au lancement explicite d'une mission
et s'arrête à la livraison. Joindre une courte vidéo de l'écran « Mode
chauffeur » évite un aller-retour.

### 6. Visuels et fiche

Captures d'écran iPhone (6,9" et 6,5"). `supportsTablet` est à `true` :
soit fournir aussi les captures iPad et vérifier l'affichage sur tablette,
soit **passer ce réglage à `false`** — l'application est pensée en portrait
téléphone, c'est le plus simple.

### 7. Paiements

Stripe est autorisé ici : le convoyage et l'expédition sont des services
physiques, pas du contenu numérique. Aucun achat intégré n'est requis.

## Enchaînement une fois le compte Apple ouvert

```bash
# 1. Se connecter
eas login

# 2. Compiler (après la montée de SDK)
eas build --platform ios --profile production

# 3. Envoyer sur App Store Connect
eas submit --platform ios --latest
```

Puis dans App Store Connect : remplir la fiche, distribuer d'abord en
**TestFlight** pour tester sur de vrais appareils, et ne soumettre à la revue
qu'ensuite. Compter quelques jours de revue, et prévoir au moins un
aller-retour sur la localisation en arrière-plan.

## Et Android

Google Play : 25 $ une fois. Les mêmes pages légales et le même formulaire de
confidentialité sont exigés, plus une déclaration spécifique pour la
permission de localisation en arrière-plan.
