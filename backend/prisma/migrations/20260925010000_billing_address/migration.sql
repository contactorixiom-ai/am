-- Adresse de facturation : une facture doit porter le nom et l'adresse du client.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "billingAddress" TEXT;
