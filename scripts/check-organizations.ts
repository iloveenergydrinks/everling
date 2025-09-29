import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking all organizations in database:')
  console.log('=========================================')
  
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      emailPrefix: true,
      createdAt: true,
      _count: {
        select: {
          members: true,
          tasks: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (orgs.length === 0) {
    console.log('No organizations found in database!')
  } else {
    orgs.forEach((org, index) => {
      console.log(`\n${index + 1}. ${org.name}`)
      console.log(`   ID: ${org.id}`)
      console.log(`   Email: ${org.emailPrefix}@everling.io`)
      console.log(`   Slug: ${org.slug}`)
      console.log(`   Members: ${org._count.members}`)
      console.log(`   Tasks: ${org._count.tasks}`)
      console.log(`   Created: ${org.createdAt.toLocaleString()}`)
    })
  }

  console.log('\n=========================================')
  console.log(`Total organizations: ${orgs.length}`)
  
  // Check for qwer specifically
  const qwerOrg = await prisma.organization.findFirst({
    where: {
      emailPrefix: 'qwer'
    }
  })
  
  if (!qwerOrg) {
    console.log('\n⚠️  No organization found with email prefix "qwer"')
    console.log('   This is why emails to qwer@everling.io are being rejected!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())


