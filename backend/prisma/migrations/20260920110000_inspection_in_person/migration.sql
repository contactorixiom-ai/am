-- Sur le terrain, le client signe l'état des lieux sur le téléphone du
-- convoyeur, exactement comme sur un constat papier. On enregistre donc cette
-- signature, mais en la distinguant d'une signature apposée par le client
-- depuis son propre compte : la valeur probante n'est pas la même.
ALTER TABLE "Inspection"
  ADD COLUMN IF NOT EXISTS "clientSignedInPerson" BOOLEAN NOT NULL DEFAULT false;
