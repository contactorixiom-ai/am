-- Extensions activées au démarrage du conteneur Postgres.
-- Note : PostGIS retiré car non disponible sur Railway's default Postgres
-- et inutile (nos coordonnées sont des Float, pas des Geography/Geometry).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
