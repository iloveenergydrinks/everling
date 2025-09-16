#!/usr/bin/env node

// Safe database update script for production
// Run this with: node scripts/update-db.js

const { execSync } = require('child_process');

console.log('🚀 Starting database schema update...');
console.log('📅 Date:', new Date().toISOString());

try {
  // First, generate the Prisma client
  console.log('\n📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Then push the schema changes
  console.log('\n🔄 Updating database schema...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  
  console.log('\n✅ Database schema updated successfully!');
  console.log('📊 New columns added:');
  console.log('  - assigned_to_email');
  console.log('  - assigned_by_email');
  console.log('  - task_type');
  console.log('  - user_role');
  console.log('  - stakeholders');
} catch (error) {
  console.error('\n❌ Failed to update database schema:', error.message);
  process.exit(1);
}
