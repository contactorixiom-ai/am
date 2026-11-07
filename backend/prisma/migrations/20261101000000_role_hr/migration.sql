-- Rôle « RH » : reçoit et traite les documents administratifs (pièces des
-- convoyeurs, documents officiels), sans accès aux montants ni à l'exploitation.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HR';
