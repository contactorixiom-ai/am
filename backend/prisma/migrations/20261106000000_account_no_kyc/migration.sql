-- Pièces du convoyeur : RIB, attestation d'hébergement (+ pièce d'identité de
-- l'hébergeant) et photo faciale. Numéro de compte unique pour chaque compte.
-- Rejouable sans risque.
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'BANK_DETAILS';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'HOSTING_CERTIFICATE';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'HOST_IDENTITY';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'SELFIE';

CREATE SEQUENCE IF NOT EXISTS "User_accountNo_seq" AS INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountNo" INTEGER;

-- Comptes existants : numérotés par ancienneté, à la suite des numéros déjà donnés.
WITH base AS (SELECT COALESCE(MAX("accountNo"), 0) AS m FROM "User"),
     todo AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
       FROM "User" WHERE "accountNo" IS NULL
     )
UPDATE "User" u SET "accountNo" = base.m + todo.rn
FROM todo, base WHERE u.id = todo.id;

SELECT setval('"User_accountNo_seq"', GREATEST((SELECT COALESCE(MAX("accountNo"), 0) FROM "User"), 1), (SELECT COUNT(*) > 0 FROM "User"));
ALTER TABLE "User" ALTER COLUMN "accountNo" SET DEFAULT nextval('"User_accountNo_seq"');
ALTER TABLE "User" ALTER COLUMN "accountNo" SET NOT NULL;
ALTER SEQUENCE "User_accountNo_seq" OWNED BY "User"."accountNo";
CREATE UNIQUE INDEX IF NOT EXISTS "User_accountNo_key" ON "User"("accountNo");
