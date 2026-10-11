# Notifications push Android : la clé Firebase

**Rien à faire sur Railway.** Le serveur envoie les notifications par le
service d'Expo, qui les transmet à Google (Android) et à Apple (iPhone). La
clé Firebase sert à Expo et à l'application Android, pas au serveur.

Sans elle, l'application fonctionne normalement : seules les notifications
push Android restent inactives (les alertes restent visibles dans
l'application, onglet Notifications).

Compter une demi-heure. Il faut le compte Google de la société et le compte
Expo `am27z`.

---

## 1. Créer le projet Firebase

1. Ouvrir <https://console.firebase.google.com> avec le compte Google de la
   société.
2. **Ajouter un projet** → nom : `Axis Import`. Google Analytics : inutile,
   le désactiver.
3. Dans le projet : **Ajouter une application → Android**.
   - Nom du package : `com.axisimport.app` (exactement).
   - Surnom : `Axis Import Android`.
   - Certificat SHA-1 : laisser vide (inutile pour les notifications).
4. Télécharger **`google-services.json`**. Ignorer les étapes suivantes de
   l'assistant (SDK, Gradle) : Expo s'en charge.

## 2. Donner le fichier à Expo, pas au dépôt

Le dépôt est public : `google-services.json` ne doit pas y entrer (il est
déjà ignoré par git).

Sur <https://expo.dev> → projet **axis-import** → **Environment variables**
→ **Add variable** :

| Champ | Valeur |
|---|---|
| Name | `GOOGLE_SERVICES_JSON` |
| Type | **File** → choisir `google-services.json` |
| Visibility | **Secret** |
| Environments | **production** et **preview** |

L'application lit cette variable au moment de la build
(`mobile/app.config.js`) : rien d'autre à modifier.

## 3. Autoriser Expo à envoyer les notifications (clé FCM V1)

1. Firebase → ⚙️ **Paramètres du projet** → **Comptes de service** →
   **Générer une nouvelle clé privée** → confirmer. Un fichier JSON est
   téléchargé : c'est une **clé secrète**.
2. Sur le poste :
   ```bash
   cd mobile
   eas credentials
   ```
   → **Android** → **production** → **Google Service Account** →
   **Manage your Google Service Account Key for Push Notifications (FCM V1)**
   → **Set up** → choisir le fichier JSON.
   (Même chose possible sur expo.dev → projet → **Credentials** →
   `com.axisimport.app` → section **FCM V1**.)
3. Une fois la clé envoyée, **supprimer le fichier JSON du poste** (ou le
   ranger dans un coffre-fort de mots de passe). Ne jamais l'envoyer par
   e-mail ni le mettre dans le dépôt ou sur Railway.

## 4. Reconstruire l'application

Le fichier Firebase est intégré à la build : relancer
`eas build --platform android --profile production` (et `--profile preview`
pour l'APK de test). Au premier lancement, l'application demande
l'autorisation d'afficher des notifications.

Vérification : sur un téléphone Android, se connecter, puis depuis un autre
compte déclencher un événement (message, changement de statut d'un envoi) :
la notification doit arriver application fermée.
