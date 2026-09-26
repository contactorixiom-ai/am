-- Adresse de facturation : une facture doit porter le nom et l'adresse du client.
ALTER TABLE "User" ADD COLUMN "billingAddress" TEXT;
