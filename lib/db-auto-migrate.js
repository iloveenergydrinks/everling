const { PrismaClient } = require('@prisma/client')

async function autoMigrate() {
  console.log('🔄 Checking database schema...')
  const prisma = new PrismaClient()
  
  try {
    // Check if relationship columns exist
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      AND column_name = 'assigned_to_email'
      LIMIT 1
    `
    
    if (result.length === 0) {
      console.log('📦 Adding missing task relationship columns...')
      
      // Add columns if they don't exist
      await prisma.$executeRaw`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigned_to_email" TEXT`
      await prisma.$executeRaw`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigned_by_email" TEXT`
      await prisma.$executeRaw`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "task_type" TEXT`
      await prisma.$executeRaw`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "user_role" TEXT`
      await prisma.$executeRaw`ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "stakeholders" JSONB`
      
      // Create indexes
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "tasks_assigned_to_email_idx" ON "tasks"("assigned_to_email")`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "tasks_assigned_by_email_idx" ON "tasks"("assigned_by_email")`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "tasks_task_type_idx" ON "tasks"("task_type")`
      
      console.log('✅ Database schema updated successfully!')
    } else {
      console.log('✅ Database schema is up to date')
    }
  } catch (error) {
    console.error('❌ Migration error:', error)
    // Don't fail the build, just log the error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  autoMigrate()
}

module.exports = { autoMigrate }
