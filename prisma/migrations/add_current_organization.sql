-- Add current_organization_id to users table
-- This tracks which organization a user is currently viewing
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "current_organization_id" TEXT;


