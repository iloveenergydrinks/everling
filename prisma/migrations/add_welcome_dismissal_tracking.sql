-- Add welcome dismissal tracking fields to users table
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "welcome_dismissed" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "welcome_dismissed_at" TIMESTAMP WITH TIME ZONE;
