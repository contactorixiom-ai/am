-- Remboursement d'un règlement (commande annulée après paiement).
-- Idempotent : rejouable sans erreur (voir scripts/db-deploy.js).
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
