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

    const [
      totalUsers, 
      totalOrganizations, 
      totalTasks, 
      totalEmails,
      verifiedUsers,
      activeOrgs,
      totalApiKeys,
      processedEmails
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.task.count(),
      prisma.emailLog.count(),
      prisma.user.count({ where: { emailVerified: { not: null } } }),
      prisma.organization.count({ where: { tasksCreated: { gt: 0 } } }),
      prisma.apiKey.count(),
      prisma.emailLog.count({ where: { processed: true } })
    ])

    // Calculate percentages
    const verificationRate = totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
    const emailSuccessRate = totalEmails > 0 ? Math.round((processedEmails / totalEmails) * 100) : 0

    return NextResponse.json({
      totalUsers,
      totalOrganizations,
      totalTasks,
      totalEmails,
      verifiedUsers,
      activeOrgs,
      totalApiKeys,
      processedEmails,
      verificationRate,
      emailSuccessRate
    })
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
