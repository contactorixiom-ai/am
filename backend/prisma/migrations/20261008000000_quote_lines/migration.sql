-- Lignes de la grille import-export enregistrées avec le devis.
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "lines" JSONB;
