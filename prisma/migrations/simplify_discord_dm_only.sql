-- Remove channel-related fields and add DM status tracking
ALTER TABLE "User" 
  DROP COLUMN IF EXISTS "discordChannelId",
  ADD COLUMN IF NOT EXISTS "discordDMEnabled" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "discordDMError" TEXT;
