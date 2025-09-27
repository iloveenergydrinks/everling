# Manual Database Fix for Railway

Since the automatic migration isn't working, you need to run the migration manually.

## Option 1: Use Railway's Database Query Tool

1. In Railway Dashboard, go to your **Postgres** service (not the app service)
2. Click on the **Data** tab
3. Click **Query**
4. Run this SQL to create the missing tables:

```sql
-- Create accounts table for OAuth
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create verification_tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
```

## Option 2: Connect via Railway CLI

1. Install Railway CLI if you haven't:
```bash
brew install railway
```

2. Login and link your project:
```bash
railway login
railway link
```

3. Connect to your database:
```bash
railway connect postgres
```

4. Run the migration:
```bash
npx prisma db push --accept-data-loss
```

## Option 3: Use the Database Connection String Locally

1. Get your DATABASE_URL from Railway Variables
2. Run locally:
```bash
DATABASE_URL="your-production-database-url" npx prisma db push --accept-data-loss
```

## After Running the Migration

1. Restart your Railway service:
   - Go to your everling service
   - Click the three dots menu
   - Select "Restart"

2. Try Google login again at https://everling.io

The error should be resolved!
