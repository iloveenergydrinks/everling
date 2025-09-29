import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { organizationId } = await req.json()

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Verify user is a member of this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: {
          email: session.user.email
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 }
      )
    }

    // Update user's current organization
    await prisma.user.update({
      where: {
        email: session.user.email
      },
      data: {
        currentOrganizationId: organizationId
      }
    })

    return NextResponse.json({ 
      success: true,
      organizationId 
    })
  } catch (error) {
    console.error('Error switching organization:', error)
    return NextResponse.json(
      { error: 'Failed to switch organization' },
      { status: 500 }
    )
  }
}

