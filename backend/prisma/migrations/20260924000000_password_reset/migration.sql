-- Liens de réinitialisation du mot de passe. Il n'existait aucun moyen de
-- retrouver l'accès à son compte, et les clients créés par Axis lors d'une
-- prise de commande recevaient un mot de passe aléatoire qu'ils ne
-- pouvaient jamais connaître. Seule l'empreinte du jeton est conservée.
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
