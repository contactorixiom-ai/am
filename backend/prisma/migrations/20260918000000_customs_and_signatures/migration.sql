-- Rattrapage de dérive : ces objets existaient dans schema.prisma mais aucune
-- migration ne les créait. Sur une base montée par « prisma migrate deploy »,
-- le module douane (CountryRegulation, CargoTrackingNote) et la signature de
-- document (Document.signatureUrl / signedBy) échouaient à l'exécution.
--
-- Écrit en IF NOT EXISTS : certaines bases ont pu être créées par
-- « prisma db push » et possèdent déjà ces objets ; la migration doit alors
-- passer sans rien casser.

DO $$ BEGIN
  CREATE TYPE "CargoTrackingType" AS ENUM ('BSC', 'BESC', 'ECTN', 'BIETC', 'FERI', 'CARGO_WAIVER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CargoTrackingStatus" AS ENUM ('NOT_REQUIRED', 'TO_REQUEST', 'DRAFT', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'ISSUED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "signedBy" UUID;

CREATE TABLE IF NOT EXISTS "CountryRegulation" (
    "id" UUID NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "cargoTrackingType" "CargoTrackingType",
    "cargoMandatory" BOOLEAN NOT NULL DEFAULT true,
    "authority" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "customsNotes" TEXT,
    "requiredDocuments" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryRegulation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CargoTrackingNote" (
    "id" UUID NOT NULL,
    "parcelId" UUID,
    "regulationId" UUID,
    "type" "CargoTrackingType" NOT NULL,
    "status" "CargoTrackingStatus" NOT NULL DEFAULT 'TO_REQUEST',
    "number" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "blNumber" TEXT,
    "hsCode" TEXT,
    "fobValueCents" INTEGER,
    "feeCents" INTEGER,
    "issuedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoTrackingNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CountryRegulation_countryCode_key" ON "CountryRegulation"("countryCode");
CREATE INDEX IF NOT EXISTS "CountryRegulation_countryCode_idx" ON "CountryRegulation"("countryCode");
CREATE INDEX IF NOT EXISTS "CargoTrackingNote_parcelId_idx" ON "CargoTrackingNote"("parcelId");
CREATE INDEX IF NOT EXISTS "CargoTrackingNote_destinationCountry_status_idx" ON "CargoTrackingNote"("destinationCountry", "status");

DO $$ BEGIN
  ALTER TABLE "CargoTrackingNote" ADD CONSTRAINT "CargoTrackingNote_parcelId_fkey"
    FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CargoTrackingNote" ADD CONSTRAINT "CargoTrackingNote_regulationId_fkey"
    FOREIGN KEY ("regulationId") REFERENCES "CountryRegulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
