-- Initialize PostgreSQL database with required extensions

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search with trigram support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for better search performance
-- (will be created by Prisma migrations)

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE data_management_platform TO dmp_user;
