-- Empreinte SHA-256 des termes du dossier au moment de la signature.
-- Permet de vérifier a posteriori que rien n'a bougé depuis : le contrat
-- imprimait jusqu'ici une « empreinte SHA » qui n'en était pas une.
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
