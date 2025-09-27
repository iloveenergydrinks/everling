import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has an organization
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            emailPrefix: true
          }
        }
      }
    })

    if (membership) {
      return NextResponse.json({
        hasOrganization: true,
        organization: {
          id: membership.organization.id,
          name: membership.organization.name,
          agentEmail: `${membership.organization.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`,
          role: membership.role
        }
      })
    }

    return NextResponse.json({
      hasOrganization: false
    })

  } catch (error) {
    console.error('Error checking user organization:', error)
    return NextResponse.json(
      { error: 'Failed to check organization' },
      { status: 500 }
    )
  }
}
