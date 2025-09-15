import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// Debug endpoint to check why allowed emails aren't loading
export async function GET(request: NextRequest) {
  try {
    // Step 1: Check session
    const session = await getServerSession(authOptions)
    
    const debugInfo: any = {
      hasSession: !!session,
      sessionData: session ? {
        userId: session.user?.id,
        email: session.user?.email,
        organizationId: session.user?.organizationId,
        organizationSlug: session.user?.organizationSlug,
      } : null,
    }

    if (!session) {
      return NextResponse.json({
        error: "No session found",
        debug: debugInfo
      }, { status: 401 })
    }

    if (!session.user?.organizationId) {
      return NextResponse.json({
        error: "No organizationId in session",
        debug: debugInfo
      }, { status: 401 })
    }

    // Step 2: Try to fetch allowed emails
    try {
      const allowedEmails = await prisma.allowedEmail.findMany({
        where: {
          organizationId: session.user.organizationId,
        },
        include: {
          addedBy: {
            select: {
              name: true,
              email: true,
            }
          }
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      debugInfo.allowedEmailsCount = allowedEmails.length
      debugInfo.allowedEmails = allowedEmails

      // Step 3: Check if user's email is in allowed list
      const userEmail = session.user.email?.toLowerCase()
      debugInfo.userEmailInList = allowedEmails.some(e => e.email === userEmail)

      // Step 4: Check organization exists
      const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { id: true, name: true, slug: true }
      })
      debugInfo.organization = org

      return NextResponse.json({
        success: true,
        debug: debugInfo
      })
    } catch (dbError: any) {
      debugInfo.databaseError = dbError.message
      return NextResponse.json({
        error: "Database query failed",
        debug: debugInfo
      }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({
      error: "Unexpected error",
      message: error.message
    }, { status: 500 })
  }
}
