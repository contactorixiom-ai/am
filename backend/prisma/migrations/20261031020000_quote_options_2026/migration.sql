-- Options des grilles 2026 : treuillage (plateau), mise en main VIP, lavage.
ALTER TYPE "QuoteOptionKind" ADD VALUE IF NOT EXISTS 'NON_ROLLING';
ALTER TYPE "QuoteOptionKind" ADD VALUE IF NOT EXISTS 'VIP_HANDOVER';
ALTER TYPE "QuoteOptionKind" ADD VALUE IF NOT EXISTS 'EXPRESS_WASH';
