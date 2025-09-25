import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        discordId: true,
        discordUsername: true,
        discordConnected: true,
        discordUserId: true,
        discordDigestEnabled: true,
        discordDMEnabled: true,
        discordDMError: true
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      connected: !!user.discordConnected,
      username: user.discordUsername,
      userId: user.discordUserId,
      discordId: user.discordId,
      digestEnabled: user.discordDigestEnabled,
      dmEnabled: user.discordDMEnabled,
      dmError: user.discordDMError
    })
    
  } catch (error) {
    console.error('Error fetching Discord status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Discord status' },
      { status: 500 }
    )
  }
}
