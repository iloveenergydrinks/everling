import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/user/organizations - Get all organizations for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userWithOrgs = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organizations: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                emailPrefix: true,
                plan: true
              }
            }
          }
        }
      }
    })

    if (!userWithOrgs) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Transform the data to a simpler format
    const organizations = userWithOrgs.organizations.map(om => ({
      id: om.organization.id,
      name: om.organization.name,
      slug: om.organization.slug,
      emailPrefix: om.organization.emailPrefix,
      plan: om.organization.plan,
      role: om.role,
      joinedAt: om.joinedAt
    }))

    return NextResponse.json({
      organizations,
      currentOrganizationId: session.user.organizationId
    })

  } catch (error) {
    console.error('Error fetching user organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

