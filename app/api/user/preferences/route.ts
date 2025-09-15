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
        notificationType: true,
        digestTime: true,
        timezone: true,
        emailDigestEnabled: true,
        smsDigestEnabled: true,
        phoneNumber: true,
        whatsappEnabled: true,
        whatsappVerified: true
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    const preferences = {
      notificationType: user.notificationType || 'email',
      digestTime: user.digestTime || '08:00',
      timezone: user.timezone || 'America/New_York',
      emailDigestEnabled: user.emailDigestEnabled ?? true,
      smsDigestEnabled: user.smsDigestEnabled ?? false,
      phoneNumber: user.phoneNumber,
      smsEnabled: user.whatsappEnabled,
      smsVerified: user.whatsappVerified
    }

    console.log('Returning preferences:', preferences)

    return NextResponse.json(preferences)
    
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const {
      notificationType,
      digestTime,
      timezone,
      emailDigestEnabled,
      smsDigestEnabled
    } = body
    
    // Validate inputs
    if (notificationType && !['email', 'sms', 'both', 'none'].includes(notificationType)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      )
    }
    
    if (digestTime && !/^\d{2}:\d{2}$/.test(digestTime)) {
      return NextResponse.json(
        { error: 'Invalid time format' },
        { status: 400 }
      )
    }
    
    console.log('Updating preferences:', {
      notificationType,
      digestTime,
      timezone,
      emailDigestEnabled,
      smsDigestEnabled
    })

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        notificationType: notificationType || 'email',
        digestTime: digestTime || '08:00',
        timezone: timezone || 'America/New_York',
        emailDigestEnabled: emailDigestEnabled ?? true,
        smsDigestEnabled: smsDigestEnabled ?? false
      }
    })

    console.log('Updated user timezone:', updatedUser.timezone)
    
    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: {
        notificationType: updatedUser.notificationType,
        digestTime: updatedUser.digestTime,
        timezone: updatedUser.timezone,
        emailDigestEnabled: updatedUser.emailDigestEnabled,
        smsDigestEnabled: updatedUser.smsDigestEnabled
      }
    })
    
  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
