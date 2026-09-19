# Obtenir l'APK — marche à suivre

Cinq commandes, une vingtaine de minutes d'attente, et tu as un lien à
envoyer par WhatsApp. Tout ce qui pouvait échouer côté code a été vérifié :
il ne reste que la partie qui demande ton compte.

---

## Avant de commencer

Il te faut un **compte Expo**. Le dépôt est configuré pour `am27z` — si tu
utilises un autre compte, change la ligne `"owner"` dans `mobile/app.json`,
sinon la build sera refusée.

C'est gratuit, et aucun compte Apple ou Google n'est nécessaire pour l'APK.

---

## Les commandes

```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure
npm run build:apk
```

### Ce que fait chaque ligne

**`npm install -g eas-cli`** — installe l'outil de build d'Expo. Une fois
pour toutes sur ta machine.

**`eas login`** — demande ton identifiant et ton mot de passe Expo.

**`eas build:configure`** — crée le projet côté Expo et écrit son
identifiant dans `app.json`. **Pense à committer ce changement** : sans lui,
les builds suivantes recréeraient un projet différent.

**`npm run build:apk`** — lance la construction. Le terminal affiche un lien
vers la page de suivi ; tu peux fermer le terminal, la build continue sur
les serveurs d'Expo.

---

## À la fin

EAS affiche un lien de téléchargement et un QR code. Deux façons de
distribuer :

- **Le lien** : à envoyer par WhatsApp ou SMS. Le convoyeur l'ouvre sur son
  téléphone et installe.
- **Le QR code** : à scanner directement depuis la page de build.

À l'installation, Android demandera d'autoriser les **« sources
inconnues »** — c'est normal pour une application hors Play Store.

---

## Ce qu'il faut dire au convoyeur

Une seule chose, mais elle est déterminante :

> Quand l'application demande l'accès à ta position, choisis
> **« Toujours autoriser »**.

Avec « Seulement quand l'app est ouverte », le suivi s'arrêtera dès qu'il
verrouillera son téléphone. L'application le lui signalera, mais autant
qu'il le sache dès le départ.

Une fois le suivi lancé, une notification **« Convoyage en cours »** reste
affichée en permanence. Elle est imposée par Android pour tout partage de
position, et c'est aussi ce qui garantit au convoyeur qu'il sait quand sa
position est transmise.

---

## Si la build échoue

Le message d'erreur d'EAS est précis. Les deux causes les plus courantes :

- **`owner` ne correspond pas à ton compte** — corrige la ligne dans
  `mobile/app.json`.
- **Une dépendance incompatible** — relance `npm run check:native`, qui
  reproduit localement la génération des projets natifs et signale le
  problème en quelques secondes au lieu de vingt minutes.

---

## Corriger un bug après distribution

Pour toute correction qui ne touche pas au code natif, inutile de refaire
une build :

```bash
cd mobile
eas update --branch preview --message "Correction de l'affectation"
```

Les téléphones reçoivent la mise à jour au redémarrage de l'application.
Une nouvelle build n'est nécessaire que si l'on ajoute un module natif ou
qu'on change les permissions.
