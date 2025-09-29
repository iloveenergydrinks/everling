import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/invite/accept - Accept invitation (for logged-in users)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'You must be logged in to accept an invitation' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true
      }
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation' },
        { status: 404 }
      )
    }

    // Verify invitation is for this user
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation is for a different email address' },
        { status: 403 }
      )
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      )
    }

    // Check if already used
    if (invitation.usedAt) {
      return NextResponse.json(
        { error: 'This invitation has already been used' },
        { status: 400 }
      )
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: invitation.organizationId,
        userId: session.user.id
      }
    })

    if (existingMember) {
      // Mark invitation as used anyway
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() }
      })

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        organizationId: invitation.organizationId
      })
    }

    // Add user to organization and mark invitation as used
    await prisma.$transaction(async (tx) => {
      // Add to organization
      await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role
        }
      })

      // Mark invitation as used
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() }
      })
    })

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${invitation.organization.name}`,
      organizationId: invitation.organizationId
    })

  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}

