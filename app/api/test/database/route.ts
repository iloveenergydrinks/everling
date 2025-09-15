import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check database connection
    let dbStatus = 'unknown'
    let organizationCount = 0
    let userCount = 0
    let allowedEmailCount = 0
    
    try {
      organizationCount = await prisma.organization.count()
      userCount = await prisma.user.count()
      allowedEmailCount = await prisma.allowedEmail.count()
      dbStatus = 'connected'
    } catch (dbError: any) {
      dbStatus = `error: ${dbError.message}`
    }

    // Test 2: Check session
    const session = await getServerSession(authOptions)
    
    // Test 3: If session exists, check user's allowed emails
    let userAllowedEmails: any[] = []
    if (session?.user?.organizationId) {
      try {
        userAllowedEmails = await prisma.allowedEmail.findMany({
          where: {
            organizationId: session.user.organizationId
          },
          select: {
            email: true,
            createdAt: true
          }
        })
      } catch (error) {
        console.error('Error fetching user allowed emails:', error)
      }
    }

    return NextResponse.json({
      status: "Database and session check",
      database: {
        status: dbStatus,
        counts: {
          organizations: organizationCount,
          users: userCount,
          allowedEmails: allowedEmailCount
        }
      },
      session: {
        exists: !!session,
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          organizationId: session.user.organizationId,
          organizationSlug: session.user.organizationSlug
        } : null
      },
      userAllowedEmails: userAllowedEmails.length > 0 ? userAllowedEmails : 'none found',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({
      error: "Test failed",
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
