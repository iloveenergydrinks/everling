import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if we only need the count
    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'
    
    if (countOnly) {
      const count = await prisma.emailLog.count({
        where: {
          organizationId: session.user.organizationId
        }
      })
      return NextResponse.json({ count })
    }

    // Get both count and limited data
    const [emailLogs, totalCount] = await Promise.all([
      prisma.emailLog.findMany({
        where: {
          organizationId: session.user.organizationId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50 // Limit to last 50 emails
      }),
      prisma.emailLog.count({
        where: {
          organizationId: session.user.organizationId
        }
      })
    ])

    return NextResponse.json({
      logs: emailLogs,
      totalCount,
      displayedCount: emailLogs.length,
      hasMore: totalCount > 50
    })

  } catch (error) {
    console.error("Error fetching email logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch email logs" },
      { status: 500 }
    )
  }
}

