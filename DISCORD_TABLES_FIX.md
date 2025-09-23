# Discord Tables Fix - Production Database

## Problem
The production database is missing two tables required for Discord integration:
- `discord_jobs` - tracks Discord message processing
- `discord_processed_messages` - prevents duplicate message processing

## Quick Fix

### Option 1: Via Railway CLI (Recommended)

1. Install Railway CLI if not already installed:
```bash
npm install -g @railway/cli
```

2. Connect to your Railway project:
```bash
railway login
railway link
```

3. Run the migration:
```bash
railway run npx prisma db push
```

### Option 2: Direct Database Connection

If you have direct access to your PostgreSQL database, run this SQL:

```sql
-- Create discord_jobs table for tracking Discord message processing
CREATE TABLE IF NOT EXISTS discord_jobs (
    message_id VARCHAR(255) PRIMARY KEY,
    organization_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'processing',
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_discord_jobs_org_id ON discord_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_discord_jobs_status ON discord_jobs(status);
CREATE INDEX IF NOT EXISTS idx_discord_jobs_created_at ON discord_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_discord_jobs_finished_at ON discord_jobs(finished_at);

-- Create discord_processed_messages table for message idempotency
CREATE TABLE IF NOT EXISTS discord_processed_messages (
    message_id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_discord_processed_created_at ON discord_processed_messages(created_at);
```

### Option 3: Via Railway Dashboard

1. Go to your Railway dashboard
2. Select your service
3. Go to the Variables tab
4. Copy your DATABASE_URL
5. Use a PostgreSQL client (like pgAdmin or psql) to connect
6. Run the SQL migration above

## After Applying the Fix

1. Redeploy your Railway service to pick up the changes
2. The error should be resolved immediately
3. Discord integration will work properly

## Prevention

The Prisma schema has been updated to include these tables, so future deployments will automatically maintain them.
