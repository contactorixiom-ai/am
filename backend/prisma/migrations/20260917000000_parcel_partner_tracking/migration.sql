-- Suivi du premier tronçon chez le transporteur partenaire (Chronopost,
-- Geodis…). Renseigné par l'administrateur quand le transporteur communique
-- le numéro ; laissé vide sinon, pour ne jamais afficher un numéro inventé.
ALTER TABLE "Parcel" ADD COLUMN "partnerCarrier" TEXT;
ALTER TABLE "Parcel" ADD COLUMN "partnerTracking" TEXT;
