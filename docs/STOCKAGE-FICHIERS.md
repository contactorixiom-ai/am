# Stockage des fichiers — ce qu'il faut faire sur Railway

## Le problème

Les pièces envoyées depuis l'application (permis de conduire et pièce
d'identité des convoyeurs, photos de véhicule) sont écrites sur le disque du
conteneur. Sur Railway, **ce disque est recréé à chaque déploiement** : sans
volume, tout ce qui a été transmis disparaît à la mise en ligne suivante.

Deux conséquences concrètes :

- un convoyeur validé devrait refaire sa vérification d'identité après chaque
  mise à jour de l'application ;
- les enregistrements en base pointent alors vers des fichiers absents.

## Ce qui a été fait côté code

- Dès qu'un volume est attaché au service, les fichiers s'y rangent
  automatiquement (`RAILWAY_VOLUME_MOUNT_PATH`) — aucune variable à régler.
- Au démarrage en production sans volume, le serveur écrit une erreur
  explicite dans les journaux au lieu de laisser le problème arriver
  silencieusement.
- Les fichiers sont désormais **servis par l'API, derrière authentification**.
  Auparavant l'upload renvoyait une URL que rien ne servait : les fichiers
  étaient donc illisibles même avant tout redéploiement.
- Une pièce KYC n'est visible que par la personne qui l'a transmise ou par un
  administrateur.
- La signature des contrats est conservée en base, pas sur le disque : elle
  pèse quelques centaines d'octets et doit survivre à tout.

## Ce qu'il reste à faire, une seule fois

1. Ouvrir le service backend dans Railway.
2. **Settings → Volumes → Add volume**, point de montage `/data`.
3. Redéployer.

C'est tout : le serveur détecte le volume et range les fichiers dans
`/data/uploads`. Pour vérifier, chercher dans les journaux de démarrage
l'absence du message « Aucun volume de stockage ».

## Si un jour le volume ne suffit plus

Le pilote S3 n'est pas écrit. Le jour où le volume devient trop petit ou
qu'une sauvegarde hors plateforme est nécessaire, il faudra l'implémenter
(compatible Cloudflare R2, Backblaze B2, Scaleway, OVH…). En attendant,
`STORAGE_DRIVER=s3` fait échouer le démarrage volontairement, pour que
personne ne croie l'avoir activé.
