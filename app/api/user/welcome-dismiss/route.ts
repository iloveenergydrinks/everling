import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Update user's welcome dismissed status
    await prisma.user.update({
      where: { email: session.user.email },
      data: { 
        welcomeDismissed: true,
        welcomeDismissedAt: new Date()
      }
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error updating welcome status:', error)
    return NextResponse.json(
      { error: 'Failed to update welcome status' },
      { status: 500 }
    )
  }
}

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
        welcomeDismissed: true,
        welcomeDismissedAt: true
      }
    })
    
    return NextResponse.json({
      dismissed: user?.welcomeDismissed || false,
      dismissedAt: user?.welcomeDismissedAt
    })
    
  } catch (error) {
    console.error('Error fetching welcome status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch welcome status' },
      { status: 500 }
    )
  }
}
