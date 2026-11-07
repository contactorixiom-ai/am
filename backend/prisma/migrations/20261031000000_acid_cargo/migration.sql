-- Égypte : numéro ACID (NAFEZA) comme bordereau de suivi.
ALTER TYPE "CargoTrackingType" ADD VALUE IF NOT EXISTS 'ACID';
