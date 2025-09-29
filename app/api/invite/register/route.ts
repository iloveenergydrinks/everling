import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// POST /api/invite/register - Register new user and accept invitation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, name, password } = body

    // Validate input
    if (!token || !name || !password) {
      return NextResponse.json(
        { error: 'Token, name, and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user, add to organization, and mark invitation as used
    await prisma.$transaction(async (tx) => {
      // Create user with verified email (since they clicked the invite link)
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          password: hashedPassword,
          name: name.trim(),
          emailVerified: new Date() // Auto-verify since they have the invite link
        }
      })

      // Add to organization
      await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role
        }
      })

      // Add user's email to allowed emails
      await tx.allowedEmail.create({
        data: {
          organizationId: invitation.organizationId,
          email: invitation.email.toLowerCase(),
          addedById: user.id,
          note: 'Added via invitation'
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
      message: 'Account created and joined organization successfully',
      email: invitation.email
    })

  } catch (error) {
    console.error('Error registering from invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

