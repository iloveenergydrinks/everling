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
