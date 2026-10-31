-- Rôle « responsable d'exploitation » : comptes distincts de celui de
-- l'administrateur, créés par lui. Rejouable sans risque.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANAGER';
