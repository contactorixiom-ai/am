-- Croquis de dommages et contrôles client : ils n'existaient que dans le
-- téléphone du convoyeur. Les stocker permet de rouvrir l'état des lieux
-- depuis un autre appareil et de redessiner le schéma à l'identique.
ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "damages" JSONB;
ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "controls" JSONB;

-- Un seul état des lieux par phase et par mission : deux PV de départ
-- contradictoires sur le même convoyage n'ont pas de sens.
-- On supprime d'abord les doublons éventuels en gardant le plus ancien.
DELETE FROM "Inspection" a
USING "Inspection" b
WHERE a."missionId" = b."missionId"
  AND a."type" = b."type"
  AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX IF NOT EXISTS "Inspection_missionId_type_key"
  ON "Inspection"("missionId", "type");
