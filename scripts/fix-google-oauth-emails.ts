/**
 * Script to fix email verification status for Google OAuth users
 * Run this script to ensure all users who signed in with Google have verified emails
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixGoogleOAuthEmails() {
  try {
    console.log('🔍 Finding Google OAuth users with unverified emails...')
    
    // Find all users who have Google accounts linked but unverified emails
    const googleUsers = await prisma.user.findMany({
      where: {
        emailVerified: null,
        accounts: {
          some: {
            provider: 'google'
          }
        }
      },
      include: {
        accounts: true
      }
    })
    
    if (googleUsers.length === 0) {
      console.log('✅ All Google OAuth users already have verified emails!')
      return
    }
    
    console.log(`📧 Found ${googleUsers.length} Google OAuth users with unverified emails`)
    
    // Update each user's email verification status
    for (const user of googleUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      })
      console.log(`✅ Verified email for user: ${user.email}`)
    }
    
    console.log('\n🎉 Successfully updated all Google OAuth users!')
    
  } catch (error) {
    console.error('❌ Error fixing Google OAuth emails:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
fixGoogleOAuthEmails()
