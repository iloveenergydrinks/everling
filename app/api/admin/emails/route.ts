import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if we only need the count
    const { searchParams } = new URL(request.url)
    const countOnly = searchParams.get('count_only') === 'true'
    
    if (countOnly) {
      const count = await prisma.emailLog.count()
      return NextResponse.json({ count })
    }

    // Get both count and limited data for all organizations
    const [emailLogs, totalCount] = await Promise.all([
      prisma.emailLog.findMany({
        select: {
          id: true,
          fromEmail: true,
          toEmail: true,
          subject: true,
          processed: true,
          taskId: true,
          createdAt: true,
          error: true,
          organization: {
            select: {
              name: true,
              slug: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 200 // Show last 200 emails globally
      }),
      prisma.emailLog.count()
    ])

    return NextResponse.json({
      logs: emailLogs,
      totalCount,
      displayedCount: emailLogs.length,
      hasMore: totalCount > 200
    })
  } catch (error) {
    console.error("Error fetching email logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch email logs" },
      { status: 500 }
    )
  }
}
