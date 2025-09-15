#!/bin/bash

echo "Starting Everling.io production server..."

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Push database schema (creates tables if they don't exist)
echo "Syncing database schema..."
npx prisma db push --accept-data-loss

# Start the Next.js server
echo "Starting Next.js server..."
npm start
