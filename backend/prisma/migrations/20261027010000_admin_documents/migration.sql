-- Historique et numérotation des documents officiels, partagés par l'équipe.
-- Rejouable sans risque.
CREATE TABLE IF NOT EXISTS "AdminDocument" (
    "id" UUID NOT NULL,
    "clientRef" TEXT,
    "typeId" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminDocument_clientRef_key" ON "AdminDocument"("clientRef");
CREATE INDEX IF NOT EXISTS "AdminDocument_createdAt_idx" ON "AdminDocument"("createdAt");
CREATE INDEX IF NOT EXISTS "AdminDocument_typeId_idx" ON "AdminDocument"("typeId");

CREATE TABLE IF NOT EXISTS "DocumentSequence" (
    "typeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("typeId", "year")
);
