-- Numérotation légale des factures : suite chronologique et continue, par
-- année. Les numéros précédents reprenaient la référence de l'envoi.
-- Rejouable sans risque : la reprise des paiements existants n'a lieu
-- qu'une fois, quand le compteur est encore vide.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");

CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "InvoiceSequence")
     AND NOT EXISTS (SELECT 1 FROM "Payment" WHERE "invoiceNumber" IS NOT NULL) THEN
    -- Paiements déjà encaissés : numérotés dans l'ordre de leur règlement.
    WITH numbered AS (
      SELECT "id",
             EXTRACT(YEAR FROM COALESCE("paidAt", "createdAt"))::int AS y,
             ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM COALESCE("paidAt", "createdAt"))
               ORDER BY COALESCE("paidAt", "createdAt"), "id"
             ) AS n
      FROM "Payment"
      WHERE "status" = 'PAID'
    )
    UPDATE "Payment" p
    SET "invoiceNumber" = 'FA-' || numbered.y || '-' || LPAD(numbered.n::text, 6, '0')
    FROM numbered
    WHERE p."id" = numbered."id";

    INSERT INTO "InvoiceSequence" ("year", "last")
    SELECT EXTRACT(YEAR FROM COALESCE("paidAt", "createdAt"))::int, COUNT(*)
    FROM "Payment"
    WHERE "status" = 'PAID'
    GROUP BY 1;
  END IF;
END $$;
