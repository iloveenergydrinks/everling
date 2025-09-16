const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'done' },
      dueDate: { not: null }
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      createdAt: true,
      status: true
    },
    orderBy: { dueDate: 'asc' },
    take: 10
  });

  console.log('\n=== Tasks in Database ===');
  console.log('Current time (server):', new Date().toISOString());
  console.log('Current time (local):', new Date().toString());
  console.log('\n');
  
  tasks.forEach(task => {
    const dueDate = new Date(task.dueDate);
    console.log(`Task: ${task.title.substring(0, 50)}...`);
    console.log(`  ID: ${task.id}`);
    console.log(`  Due Date (ISO): ${task.dueDate.toISOString()}`);
    console.log(`  Due Date (Local): ${dueDate.toString()}`);
    console.log(`  Due Date (Local Date Only): ${dueDate.toLocaleDateString()}`);
    console.log('---');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
