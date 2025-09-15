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

    const emailLogs = await prisma.emailLog.findMany({
      where: {
        organizationId: session.user.organizationId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit to last 50 emails
    })

    return NextResponse.json(emailLogs)

  } catch (error) {
    console.error("Error fetching email logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch email logs" },
      { status: 500 }
    )
  }
}

