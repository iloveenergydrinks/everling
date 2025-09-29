import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/send-email'

export const dynamic = 'force-dynamic'

// DELETE /api/organization/invites/[inviteId] - Revoke invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.organizationId || session.user.organizationRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Verify the invite belongs to this organization
    const invite = await prisma.invitation.findFirst({
      where: {
        id: params.inviteId,
        organizationId: session.user.organizationId,
        usedAt: null // Can only revoke unused invites
      }
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation not found or already used' },
        { status: 404 }
      )
    }

    // Delete the invitation
    await prisma.invitation.delete({
      where: { id: params.inviteId }
    })

    return NextResponse.json({ success: true, message: 'Invitation revoked' })

  } catch (error) {
    console.error('Error revoking invitation:', error)
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    )
  }
}

// POST /api/organization/invites/[inviteId]/resend - Resend invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.organizationId || session.user.organizationRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get the invite with organization details
    const invite = await prisma.invitation.findFirst({
      where: {
        id: params.inviteId,
        organizationId: session.user.organizationId,
        usedAt: null
      },
      include: {
        organization: {
          select: {
            name: true,
            slug: true
          }
        },
        invitedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation not found or already used' },
        { status: 404 }
      )
    }

    // Check if expired and extend if needed
    const isExpired = new Date(invite.expiresAt) < new Date()
    if (isExpired) {
      // Extend expiration by 7 days
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await prisma.invitation.update({
        where: { id: params.inviteId },
        data: { expiresAt: newExpiresAt }
      })
      invite.expiresAt = newExpiresAt
    }

    // Resend the invitation email
    const inviteLink = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`
    const inviterName = invite.invitedBy.name || invite.invitedBy.email?.split('@')[0] || 'Someone'

    await sendEmail({
      to: invite.email,
      subject: `Reminder: You're invited to join ${invite.organization.name} on Everling`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Reminder: You're invited to join ${invite.organization.name}!</h1>
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            ${inviterName} has invited you to join their organization, <strong>${invite.organization.name}</strong>, on Everling.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" 
              style="display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; margin-top: 30px;">
            This invitation link will expire in 7 days.
          </p>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Reminder: You're invited to join ${invite.organization.name} on Everling! ${inviterName} has invited you to join their organization, ${invite.organization.name}, on Everling. Accept the invitation here: ${inviteLink}. This link will expire in 7 days.`
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation resent successfully',
      expiresAt: invite.expiresAt
    })

  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}


