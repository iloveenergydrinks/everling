import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: inviteEmail }
    })

    if (existingUser) {
      // Check if already a member
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

      // Add user to organization directly
      await prisma.organizationMember.create({
        data: {
          organizationId: session.user.organizationId,
          userId: existingUser.id,
          role
        }
      })

      // Send notification email
      try {
        await sendEmail({
          to: inviteEmail,
          subject: `You've been added to ${organization.name} on Everling`,
          html: `
            <h2>Welcome to ${organization.name}!</h2>
            <p>${session.user.name || session.user.email} has added you to their organization on Everling.</p>
            <p>You now have access to:</p>
            <ul>
              <li>Create and manage tasks via ${organization.emailPrefix}@everling.io</li>
              <li>Collaborate with your team</li>
              <li>Track task progress</li>
            </ul>
            <p><a href="${process.env.NEXTAUTH_URL}/dashboard">Go to Dashboard</a></p>
          `,
          text: `Welcome to ${organization.name}! ${session.user.name || session.user.email} has added you to their organization on Everling. Go to ${process.env.NEXTAUTH_URL}/dashboard to get started.`
        })
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({ 
        success: true,
        message: 'User added to organization' 
      })

    } else {
      // User doesn't exist - send invitation email
      // In a full implementation, you might want to store pending invitations in the database
      
      try {
        await sendEmail({
          to: inviteEmail,
          subject: `You're invited to join ${organization.name} on Everling`,
          html: `
            <h2>You're invited to ${organization.name}!</h2>
            <p>${session.user.name || session.user.email} has invited you to join their organization on Everling.</p>
            <p>Everling is an AI-powered task management platform that helps teams stay organized.</p>
            <p>With Everling, you can:</p>
            <ul>
              <li>Create tasks by forwarding emails to ${organization.emailPrefix}@everling.io</li>
              <li>Get smart reminders and notifications</li>
              <li>Collaborate with your team in real-time</li>
            </ul>
            <p><a href="${process.env.NEXTAUTH_URL}/register?email=${encodeURIComponent(inviteEmail)}&org=${session.user.organizationId}">Accept Invitation & Sign Up</a></p>
          `,
          text: `You're invited to ${organization.name}! ${session.user.name || session.user.email} has invited you to join their organization on Everling. Sign up at ${process.env.NEXTAUTH_URL}/register to get started.`
        })

        return NextResponse.json({ 
          success: true,
          message: 'Invitation sent' 
        })
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError)
        return NextResponse.json(
          { error: 'Failed to send invitation email' },
          { status: 500 }
        )
      }
    }

  } catch (error) {
    console.error('Error inviting user:', error)
    return NextResponse.json(
      { error: 'Failed to invite user' },
      { status: 500 }
    )
  }
}
