import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendSMSVerification, sendTestSMS, formatPhoneForSMS } from '@/lib/sms'

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
    const { phoneNumber, action } = body
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    switch (action) {
      case 'enable':
        if (!phoneNumber) {
          return NextResponse.json(
            { error: 'Phone number required' },
            { status: 400 }
          )
        }
        
        // Format phone number
        const formattedPhone = formatPhoneForSMS(phoneNumber)
        
        // Update user with phone number
        await prisma.user.update({
          where: { id: user.id },
          data: {
            phoneNumber: formattedPhone,
            whatsappEnabled: true, // Using this field for SMS enabled
            whatsappVerified: false // Using this field for SMS verified
          }
        })
        
        // Send verification message
        const verificationResult = await sendSMSVerification(formattedPhone, user.id)
        
        if (!verificationResult.success) {
          // Rollback if verification fails
          await prisma.user.update({
            where: { id: user.id },
            data: {
              whatsappEnabled: false
            }
          })
          
          return NextResponse.json(
            { error: verificationResult.error },
            { status: 400 }
          )
        }
        
        // For simplicity, mark as verified immediately
        // In production, you'd verify the code they send back
        await prisma.user.update({
          where: { id: user.id },
          data: {
            whatsappVerified: true
          }
        })
        
        // Different message for mock mode
        const enableMessage = verificationResult.mock 
          ? 'SMS reminders enabled (Mock Mode - no real SMS will be sent)'
          : 'SMS reminders enabled. Check your phone for verification.'
        
        return NextResponse.json({
          success: true,
          message: enableMessage,
          mock: verificationResult.mock
        })
        
      case 'disable':
        await prisma.user.update({
          where: { id: user.id },
          data: {
            whatsappEnabled: false,
            whatsappVerified: false
          }
        })
        
        return NextResponse.json({
          success: true,
          message: 'SMS reminders disabled'
        })
        
      case 'test':
        if (!user.phoneNumber || !user.whatsappEnabled) {
          return NextResponse.json(
            { error: 'SMS not enabled' },
            { status: 400 }
          )
        }
        
        const testResult = await sendTestSMS(user.phoneNumber)
        
        if (!testResult.success) {
          return NextResponse.json(
            { error: testResult.error },
            { status: 400 }
          )
        }
        
        const testMessage = testResult.mock
          ? 'Test SMS simulated (Mock Mode - check server console)'
          : 'Test SMS sent to your phone'
        
        return NextResponse.json({
          success: true,
          message: testMessage,
          mock: testResult.mock
        })
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('SMS settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update SMS settings' },
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
        phoneNumber: true,
        whatsappEnabled: true,
        whatsappVerified: true,
        notificationType: true,
        digestTime: true,
        timezone: true,
        emailDigestEnabled: true,
        smsDigestEnabled: true
      }
    })
    
    return NextResponse.json({
      phoneNumber: user?.phoneNumber || null,
      enabled: user?.whatsappEnabled || false,
      verified: user?.whatsappVerified || false,
      notificationType: user?.notificationType || 'email',
      digestTime: user?.digestTime || '08:00',
      timezone: user?.timezone || 'America/New_York',
      emailDigestEnabled: user?.emailDigestEnabled ?? true,
      smsDigestEnabled: user?.smsDigestEnabled ?? false
    })
    
  } catch (error) {
    console.error('Error fetching SMS settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch SMS settings' },
      { status: 500 }
    )
  }
}
