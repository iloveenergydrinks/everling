#!/bin/bash

echo "Starting Everling.io production server..."

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Try to run SQL directly first
echo "Creating NextAuth tables directly..."
if [ ! -z "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" < init.sql 2>/dev/null || echo "Direct SQL failed, trying Prisma..."
fi

# Push database schema (creates tables if they don't exist)
echo "Syncing database schema with Prisma..."
npx prisma db push --accept-data-loss || echo "Prisma db push failed"

# Log database URL for debugging (without password)
echo "Database connected to: ${DATABASE_URL%%:*}..."

# Start the Next.js server (standalone output)
echo "Starting Next.js server (standalone)..."
node .next/standalone/server.js
