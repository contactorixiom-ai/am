# Pour Roger — deux choses à faire

Ce document ne demande aucune compétence technique. Prévoir une heure pour la
première partie, dix minutes pour la seconde.

---

# 1. Ouvrir le compte développeur Apple

C'est la seule étape qui prend du temps réel : une quinzaine de jours à cause
d'un numéro d'identification à obtenir. **Plus tôt elle est lancée, mieux
c'est** — tout le reste peut se préparer pendant ce temps.

## Ce qu'il faut avoir sous la main

- Un **identifiant Apple** avec la double authentification activée. Si
  possible, en créer un dédié à l'entreprise plutôt que d'utiliser un compte
  personnel : il servira d'accès à la boutique pendant des années.
- Le **numéro SIRET** de la société.
- Une **carte bancaire** — 99 € par an.
- Le **nom légal exact** de la société, tel qu'il figure au registre du
  commerce. Le moindre écart avec le registre fait échouer la vérification.

## Étape A — Obtenir un numéro D-U-N-S

Apple n'inscrit une société qu'avec ce numéro. Il est **gratuit**.

1. Aller sur <https://developer.apple.com/enroll/duns-lookup/>
2. Chercher la société par son nom. **Si elle apparaît déjà, noter le numéro
   affiché : il n'y a rien d'autre à faire, passer à l'étape B.**
3. Si elle n'apparaît pas, faire la demande depuis cette même page.
   Compter **5 à 14 jours ouvrés**. Un courriel confirme l'attribution.

Pendant l'attente, vérifier sur le site que le nom et l'adresse rattachés au
numéro correspondent **exactement** au registre du commerce. Une correction
demandée après coup fait perdre une semaine de plus.

## Étape B — S'inscrire au programme développeur

1. Aller sur <https://developer.apple.com/programs/enroll/>
2. Choisir **Company / Organization** (et non Individual).
3. Renseigner le numéro D-U-N-S, le nom légal, l'adresse et le site web.
4. Indiquer le rôle occupé dans la société — Apple vérifie la capacité à
   engager l'entreprise.
5. Payer les 99 €.

Apple rappelle parfois au téléphone pour confirmer. Le numéro indiqué doit
être joignable, sinon le dossier reste bloqué. Compter **2 à 7 jours** après
le paiement.

## Étape C — Une fois le compte actif

Prévenir : il ne reste alors plus qu'à lancer la compilation et à remplir la
fiche de la boutique. Il faudra à ce moment :

- des **captures d'écran** — elles sont déjà prêtes, dans `design/store/` ;
- les **textes de la fiche** : nom, sous-titre, description, mots-clés ;
- les **adresses des pages légales** — elles sont en ligne :
  - <https://contactorixiom-ai.github.io/am/confidentialite.html>
  - <https://contactorixiom-ai.github.io/am/cgu.html>
  - <https://contactorixiom-ai.github.io/am/support.html>
- **deux comptes de démonstration** pour le testeur d'Apple : un client et un
  convoyeur avec une mission en cours. Sans le second, le testeur ne voit pas
  le suivi GPS et refuse l'autorisation de localisation en arrière-plan.

## Et Android

Google Play coûte **25 $ une seule fois**, sans numéro D-U-N-S, et la
validation prend quelques jours. C'est beaucoup plus simple — autant le faire
en parallèle : <https://play.google.com/console/signup>

---

# 2. Ouvrir l'application sur son téléphone, tout de suite

Pas besoin d'attendre Apple. L'application s'ouvre dès maintenant, de deux
façons.

## Le plus simple : le navigateur

Ouvrir cette adresse sur le téléphone :

**<https://contactorixiom-ai.github.io/am/app/>**

Puis l'ajouter à l'écran d'accueil pour qu'elle ressemble à une vraie
application :

- **iPhone** — dans Safari : bouton Partager (le carré avec une flèche), puis
  *Sur l'écran d'accueil*.
- **Android** — dans Chrome : menu (trois points), puis *Ajouter à l'écran
  d'accueil*.

Tout fonctionne, **sauf le suivi GPS en arrière-plan** : un navigateur ne sait
pas continuer à transmettre la position écran éteint.

## L'autre voie : Expo Go

Utile pour voir l'application comme une vraie application mobile, avec ses
animations et son comportement natif.

1. Installer **Expo Go** depuis l'App Store ou le Play Store (gratuit).
2. Demander le lancement du serveur de développement — une commande à lancer
   de notre côté :
   ```bash
   cd mobile
   npx expo start
   ```
3. Un **QR code** apparaît. Le scanner :
   - **iPhone** : avec l'appareil photo, puis ouvrir la notification.
   - **Android** : depuis Expo Go, bouton *Scan QR code*.
4. L'application se charge. À chaque modification du code, elle se recharge
   toute seule.

**Deux limites à connaître :**

- Le **suivi GPS en arrière-plan ne fonctionne pas** dans Expo Go, ni sur
  iPhone ni sur Android. Le mode chauffeur s'ouvre et se parcourt, mais la
  position cesse d'être transmise dès que le téléphone se verrouille. C'est
  une limite d'Expo Go, pas de l'application.
- Le téléphone et l'ordinateur qui lance la commande doivent être sur le
  **même réseau Wi-Fi**.

Pour tester le suivi GPS pour de vrai — la fonction la plus importante du mode
chauffeur — il faut une version installée, dite *client de développement* :
voir `docs/BUILD-APPLICATION.md`.

## Quel compte utiliser

Un compte se crée directement depuis l'application.

Pour disposer de **l'espace Axis** — tableau de bord, prise de commande,
génération des documents, états des lieux — le compte doit être promu
administrateur après sa création. C'est une commande à lancer une fois :

```bash
cd backend
npm run promote:admin -- roger@exemple.fr
```

Ensuite, l'espace apparaît dans *Profil → Espace admin*.

## Valider les convoyeurs

Un convoyeur s'inscrit avec « Je suis chauffeur », puis envoie ses pièces
depuis l'application. Elles arrivent dans *Espace admin → Convoyeurs* (un
bandeau le signale sur le tableau de bord). Pour chaque photo : **Valider**,
ou **Refuser…** avec un motif, qui est envoyé au convoyeur.

Un convoyeur peut accepter des missions dès que sa **pièce d'identité (ou son
passeport)** et son **permis** sont validés.

## Au quotidien

- **Nouvelle commande** : notification, puis *Espace admin → Envois*. Chaque
  carte montre le client, le créneau souhaité, les adresses, le prix et si
  c'est payé.
- **Affecter** : seuls les convoyeurs aux pièces validées peuvent l'être.
- **Encaisser** : pour un règlement reçu hors de l'application (virement,
  espèces, chèque, TPE, mobile money). L'envoi passe « payé », le client est
  prévenu, la facture reçoit son numéro (FA-2026-000001…). La facture se
  génère ensuite avec le bouton « Facture ».
- **Messages** : *Profil → Messages*. Les clients et convoyeurs écrivent à
  Axis depuis « Contacter Axis ».
- **Alerte convoyeur** : si un convoyeur reste arrêté plus de 5 minutes sans
  répondre, Roger reçoit son nom, son téléphone et sa position.
- **Clôturer / Annuler** : sous chaque mission. Une mission annulée alors que
  le client avait payé est signalée « à rembourser » (depuis Stripe).
- Le convoyeur ne peut pas partir sans l'état des lieux de départ signé, ni
  déclarer la livraison sans celui d'arrivée : l'application l'y conduit.

## Ce que l'application promet aux clients

Tout ce qui s'affiche doit être vrai. Réglages dans `mobile/app.json`,
rubrique `extra.operations` :

- `dropOffAddress` / `dropOffHours` : où et quand un client dépose un colis
  chez Axis. Vide = « adresse communiquée à la confirmation ».
- `relayPoints` : laisser à `false` tant qu'il n'y a pas de contrat avec un
  réseau de points relais (Mondial Relay, La Poste…) et ses étiquettes.
- `homePickup` : enlèvement à domicile proposé ou non.

L'assurance (`extra.insurance`) n'apparaît nulle part tant qu'elle n'est pas
renseignée, et l'option « Garantie étendue » n'est proposée qu'avec une
police réelle.

## Donner l'accès à un client pris au téléphone

Quand Roger saisit une commande pour un **nouveau client**, le compte de ce
client est créé sans mot de passe connu. Juste après l'enregistrement,
l'application affiche **« Accès client »** avec un lien à envoyer :

- **Envoyer par WhatsApp** si un numéro a été saisi (message déjà rédigé) ;
- sinon **Copier le message** et l'envoyer par SMS ou e-mail.

Le client ouvre le lien, choisit son mot de passe et arrive directement dans
son espace : suivi, contrat à signer, facture à régler. Le lien est valable
7 jours et ne sert qu'une fois. Pour en renvoyer un : *Espace admin → Envois*,
bouton **« Accès »** sur la mission du client.

Un client qui a perdu son mot de passe touche **« Mot de passe oublié ? »**
sur l'écran de connexion. Tant que l'envoi d'e-mails n'est pas branché
(clé `RESEND_API_KEY` sur Railway), il est invité à contacter Axis : Roger lui
envoie alors un lien avec le bouton « Accès ».

---

# En résumé

| Quoi | Qui | Combien de temps | Coût |
|---|---|---|---|
| Numéro D-U-N-S | Roger | 5 à 14 jours | gratuit |
| Compte développeur Apple | Roger | 2 à 7 jours après | 99 €/an |
| Compte Google Play | Roger | quelques jours | 25 $ une fois |
| Ouvrir l'app dans le navigateur | Roger | 2 minutes | — |
| Expo Go | à deux | 10 minutes | — |
