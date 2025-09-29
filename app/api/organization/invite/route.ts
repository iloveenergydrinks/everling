import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/send-email'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/organization/invite - Invite user to organization
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (session.user.organizationRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role = 'member' } = body

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const inviteEmail = email.toLowerCase().trim()

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        name: true,
        emailPrefix: true
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: inviteEmail }
    })

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: session.user.organizationId,
          userId: existingUser.id
        }
      })

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        )
      }
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email: inviteEmail,
        organizationId: session.user.organizationId,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      )
    }

    // Create invitation token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    // Create invitation record
    const invitation = await prisma.invitation.create({
      data: {
        token,
        email: inviteEmail,
        organizationId: session.user.organizationId,
        role,
        invitedById: session.user.id,
        expiresAt
      }
    })

    // Send invitation email
    const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${token}`
    
    try {
      await sendEmail({
        to: inviteEmail,
        subject: `You're invited to join ${organization.name} on Everling`,
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a; margin-bottom: 24px;">You're invited to ${organization.name}!</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 16px;">
              ${session.user.name || session.user.email} has invited you to join their organization on Everling.
            </p>
            
            <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <h3 style="color: #1a1a1a; margin-top: 0; margin-bottom: 12px;">What is Everling?</h3>
              <p style="color: #666; margin: 0;">
                Everling is an AI-powered task management platform. Simply forward emails to 
                <strong>${organization.emailPrefix}@everling.io</strong> to automatically create and track tasks.
              </p>
            </div>
            
            <div style="margin: 32px 0;">
              <a href="${inviteUrl}" 
                 style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; 
                        border-radius: 6px; text-decoration: none; font-weight: 500;">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 32px;">
              This invitation expires in 7 days. If you have any questions, please contact ${session.user.email}.
            </p>
          </div>
        `,
        text: `You're invited to ${organization.name}! ${session.user.name || session.user.email} has invited you to join their organization on Everling. Accept the invitation at: ${inviteUrl}`
      })

      return NextResponse.json({ 
        success: true,
        message: 'Invitation sent successfully',
        invitationId: invitation.id
      })
      
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      
      // Delete the invitation if email fails
      await prisma.invitation.delete({
        where: { id: invitation.id }
      })
      
      return NextResponse.json(
        { error: 'Failed to send invitation email' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error inviting user:', error)
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    )
  }
}
