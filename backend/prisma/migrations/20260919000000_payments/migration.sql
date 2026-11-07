-- Trace serveur des règlements client. Jusqu'ici, le paiement n'existait que
-- dans le téléphone du client (AsyncStorage) : l'administrateur ne savait pas
-- qui avait payé, et le client retrouvait sa facture « à régler » après une
-- réinstallation de l'application.

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "missionId" UUID,
    "parcelId" UUID,
    "sessionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "reference" TEXT,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_sessionId_key" ON "Payment"("sessionId");
CREATE INDEX "Payment_clientId_status_idx" ON "Payment"("clientId", "status");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_missionId_idx" ON "Payment"("missionId");
CREATE INDEX "Payment_parcelId_idx" ON "Payment"("parcelId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_parcelId_fkey"
    FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
