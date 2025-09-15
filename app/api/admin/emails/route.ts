import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get ALL email logs globally across all organizations
    const emailLogs = await prisma.emailLog.findMany({
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
