// Configuration dynamique : reprend app.json tel quel et y ajoute le fichier
// Firebase des notifications Android (google-services.json), sans le mettre
// dans le dépôt public.
//   - build EAS : variable de type fichier GOOGLE_SERVICES_JSON (docs/FIREBASE.md) ;
//   - poste local : fichier mobile/google-services.json, ignoré par git.
// Sans l'un ni l'autre, rien ne change : l'application fonctionne, seules
// les notifications push Android restent inactives.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const file = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  if (!file) return config;
  return { ...config, android: { ...config.android, googleServicesFile: file } };
};
