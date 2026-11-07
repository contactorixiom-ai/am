-- Rôles web designer / communication digitale et responsable sponsoring ;
-- groupes de discussion internes. Rejouable sans risque.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'WEB_DESIGNER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SPONSORSHIP';
ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'GROUP';
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "createdById" UUID;
