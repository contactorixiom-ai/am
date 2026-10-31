-- Nouveaux convoyages : bus / autocar (permis D) et transport sur plateau.
ALTER TYPE "QuoteService" ADD VALUE IF NOT EXISTS 'CONVOY_BUS';
ALTER TYPE "QuoteService" ADD VALUE IF NOT EXISTS 'CONVOY_FLATBED';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'BUS';
