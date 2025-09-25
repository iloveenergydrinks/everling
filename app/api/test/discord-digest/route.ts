import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendDiscordDigest } from '@/lib/daily-digest'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        discordUserId: true,
        discordUsername: true,
        discordDigestEnabled: true
      }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    if (!user.discordUserId) {
      return NextResponse.json({ 
        error: 'Discord not connected',
        details: 'Please connect your Discord account first'
      }, { status: 400 })
    }
    
    console.log('Testing Discord digest for:', {
      userId: user.id,
      discordUserId: user.discordUserId,
      discordUsername: user.discordUsername
    })
    
    // Try to send the digest
    const result = await sendDiscordDigest(user.id, user.discordUserId)
    
    if (!result.success) {
      console.error('Discord digest failed:', result)
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send Discord digest',
        troubleshooting: [
          '1. Make sure the Everling bot is in at least one server with you',
          '2. Check that your Discord privacy settings allow DMs from server members',
          '3. Try sending a message to the bot first to establish contact',
          '4. The bot may need to be re-invited to your server with proper permissions'
        ]
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Discord digest sent successfully!',
      method: result.method
    })
    
  } catch (error: any) {
    console.error('Discord digest test error:', error)
    return NextResponse.json({
      error: 'Failed to test Discord digest',
      details: error.message
    }, { status: 500 })
  }
}
