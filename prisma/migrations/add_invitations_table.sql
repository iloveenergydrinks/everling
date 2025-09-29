-- Create invitations table for organization invites
CREATE TABLE IF NOT EXISTS "invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invited_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "invitations_organization_id_fkey" 
        FOREIGN KEY ("organization_id") 
        REFERENCES "organizations"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT "invitations_invited_by_id_fkey" 
        FOREIGN KEY ("invited_by_id") 
        REFERENCES "users"("id") 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_key" ON "invitations"("token");
CREATE INDEX IF NOT EXISTS "invitations_email_idx" ON "invitations"("email");
CREATE INDEX IF NOT EXISTS "invitations_organization_id_idx" ON "invitations"("organization_id");
CREATE INDEX IF NOT EXISTS "invitations_expires_at_idx" ON "invitations"("expires_at");

