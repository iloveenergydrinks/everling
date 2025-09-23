-- Add Discord integration fields to users table
ALTER TABLE users 
ADD COLUMN discord_id VARCHAR(255) UNIQUE,
ADD COLUMN discord_username VARCHAR(255),
ADD COLUMN discord_connected TIMESTAMP;
