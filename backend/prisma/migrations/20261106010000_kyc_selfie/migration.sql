-- Les photos de contrôle déjà envoyées (type OTHER, fichier « selfie.* »)
-- deviennent des photos faciales. Rejouable sans risque.
UPDATE "KycDocument" SET "type" = 'SELFIE' WHERE "type" = 'OTHER' AND "fileName" LIKE 'selfie.%';
