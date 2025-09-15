import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ 
        error: 'No session',
        session: null 
      })
    }
    
    // Get user with organization from database
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    })
    
    return NextResponse.json({
      session: {
        user: {
          email: session.user.email,
          name: session.user.name,
          organizationId: session.user.organizationId,
          organizationRole: session.user.organizationRole,
          organizationSlug: session.user.organizationSlug,
        }
      },
      database: {
        user: dbUser ? {
          id: dbUser.id,
          email: dbUser.email,
          organizations: dbUser.organizations.map(om => ({
            role: om.role,
            organization: {
              id: om.organization.id,
              name: om.organization.name,
              slug: om.organization.slug,
              emailPrefix: om.organization.emailPrefix
            }
          }))
        } : null
      }
    })
  } catch (error) {
    console.error('Debug session error:', error)
    return NextResponse.json({ 
      error: 'Failed to get session debug info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
