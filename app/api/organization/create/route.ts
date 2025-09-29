import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { agentName, organizationName } = body

    // Validate input
    if (!agentName || agentName.length < 3) {
      return NextResponse.json(
        { error: 'Agent name must be at least 3 characters' },
        { status: 400 }
      )
    }

    if (!organizationName || organizationName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    // Check if agent name is available
    const existingOrg = await prisma.organization.findUnique({
      where: { emailPrefix: agentName }
    })

    if (existingOrg) {
      return NextResponse.json(
        { error: 'This agent name is already taken' },
        { status: 400 }
      )
    }

    // Create organization and add user as admin
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          slug: agentName, // Use agent name as slug
          emailPrefix: agentName,
        }
      })

      // Add user as admin
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: session.user.id,
          role: 'admin'
        }
      })

      // Add user's email to allowed emails
      if (session.user.email) {
        await tx.allowedEmail.create({
          data: {
            organizationId: organization.id,
            email: session.user.email.toLowerCase(),
            addedById: session.user.id,
            note: 'Organization creator',
          }
        })
      }

      // Set this as the user's current organization
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          currentOrganizationId: organization.id
        }
      })

      return organization
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: result.id,
        name: result.name,
        agentEmail: `${result.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`
      }
    })

  } catch (error) {
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}
