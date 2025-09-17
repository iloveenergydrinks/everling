import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check for recent unprocessed email logs (indicates active processing)
    const processingEmails = await prisma.emailLog.count({
      where: {
        organizationId: session.user.organizationId,
        processed: false,
        createdAt: {
          gte: new Date(Date.now() - 30000) // Last 30 seconds
        }
      }
    })

    // Also check for very recent processed emails (just finished)
    const recentlyProcessed = await prisma.emailLog.findMany({
      where: {
        organizationId: session.user.organizationId,
        processed: true,
        createdAt: {
          gte: new Date(Date.now() - 5000) // Last 5 seconds
        }
      },
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        taskId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    return NextResponse.json({
      isProcessing: processingEmails > 0,
      processingCount: processingEmails,
      recentlyProcessed: recentlyProcessed
    })
  } catch (error) {
    console.error("Processing status error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}