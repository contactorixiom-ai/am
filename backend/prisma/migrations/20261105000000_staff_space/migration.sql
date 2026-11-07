-- Secrétariat, comptabilité, dossier du personnel (billets, justificatifs de
-- frais, documents RH, demandes de pièces) et annonces à l'équipe.
-- Carte Vitale et attestation de droits à l'assurance maladie des convoyeurs.
-- Rejouable sans risque.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECRETARY';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'HEALTH_INSURANCE_RIGHTS';
ALTER TYPE "KycDocumentType" ADD VALUE IF NOT EXISTS 'VITALE_CARD';

DO $$ BEGIN
  CREATE TYPE "StaffFileKind" AS ENUM ('TRAVEL', 'EXPENSE', 'HR_DOCUMENT', 'EMPLOYEE_DOCUMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StaffFileStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StaffRequestStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StaffFile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "StaffFileKind" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "amountCents" INTEGER,
    "spentAt" TIMESTAMP(3),
    "missionId" UUID,
    "missionRef" TEXT,
    "requestId" UUID,
    "status" "StaffFileStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "StaffRequestStatus" NOT NULL DEFAULT 'OPEN',
    "requestedById" UUID NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipientIds" TEXT[],
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaffFile_userId_kind_idx" ON "StaffFile"("userId", "kind");
CREATE INDEX IF NOT EXISTS "StaffFile_kind_status_idx" ON "StaffFile"("kind", "status");
CREATE INDEX IF NOT EXISTS "StaffRequest_userId_status_idx" ON "StaffRequest"("userId", "status");
CREATE INDEX IF NOT EXISTS "Announcement_createdAt_idx" ON "Announcement"("createdAt");

DO $$ BEGIN
  ALTER TABLE "StaffFile" ADD CONSTRAINT "StaffFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
