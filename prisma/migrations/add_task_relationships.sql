-- Add task relationship columns if they don't exist
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigned_to_email" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigned_by_email" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "task_type" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "user_role" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "stakeholders" JSONB;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "tasks_assigned_to_email_idx" ON "tasks"("assigned_to_email");
CREATE INDEX IF NOT EXISTS "tasks_assigned_by_email_idx" ON "tasks"("assigned_by_email");
CREATE INDEX IF NOT EXISTS "tasks_task_type_idx" ON "tasks"("task_type");
