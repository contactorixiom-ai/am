-- Numérotation légale des factures : suite chronologique et continue, par
-- année. Les numéros précédents reprenaient la référence de l'envoi.
ALTER TABLE "Payment" ADD COLUMN "invoiceNumber" TEXT;
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");

CREATE TABLE "InvoiceSequence" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("year")
);

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
