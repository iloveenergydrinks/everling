const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function addAllowedEmail() {
  try {
    const emailToAdd = 'antoniacomi.laura@gmail.com'
    const orgEmailPrefix = 'antoniacomilaura' // From the logs
    
    console.log(`🔍 Finding organization with email prefix: ${orgEmailPrefix}`)
    
    // Find the organization
    const organization = await prisma.organization.findUnique({
      where: { emailPrefix: orgEmailPrefix },
      include: {
        members: {
          include: {
            user: true
          }
        },
        allowedEmails: true
      }
    })
    
    if (!organization) {
      console.log(`❌ Organization not found with email prefix: ${orgEmailPrefix}`)
      return
    }
    
    console.log(`✅ Found organization: ${organization.name} (ID: ${organization.id})`)
    console.log(`📧 Current allowed emails: ${organization.allowedEmails.map(e => e.email).join(', ') || 'none'}`)
    
    // Check if email is already in the allowed list
    const alreadyAllowed = organization.allowedEmails.some(e => e.email === emailToAdd)
    if (alreadyAllowed) {
      console.log(`⚠️ Email ${emailToAdd} is already in the allowed list`)
      return
    }
    
    // Find the user who owns this email (to set as addedBy)
    const user = await prisma.user.findUnique({
      where: { email: emailToAdd }
    })
    
    // Add the email to allowed list
    const allowedEmail = await prisma.allowedEmail.create({
      data: {
        organizationId: organization.id,
        email: emailToAdd,
        addedById: user?.id || null,
        note: user ? `${user.name || 'Organization member'} - auto-added` : 'Auto-added from email logs'
      }
    })
    
    console.log(`✅ Successfully added ${emailToAdd} to allowed emails`)
    console.log(`   Note: ${allowedEmail.note}`)
    
    // Verify by fetching updated list
    const updatedOrg = await prisma.organization.findUnique({
      where: { id: organization.id },
      include: {
        allowedEmails: true
      }
    })
    
    console.log(`\n📋 Updated allowed emails list:`)
    updatedOrg.allowedEmails.forEach(e => {
      console.log(`   - ${e.email} ${e.note ? `(${e.note})` : ''}`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addAllowedEmail()
