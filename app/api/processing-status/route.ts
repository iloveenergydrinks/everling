import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getDiscordProcessingStatus } from "@/lib/discord-processing"

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

    const discord = getDiscordProcessingStatus()

    // DB-backed Discord jobs (more reliable)
    const activeDiscordJobs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT message_id FROM discord_jobs WHERE organization_id = $1 AND finished_at IS NULL AND created_at > NOW() - INTERVAL '30 seconds'`,
      session.user.organizationId
    )
    const recentDiscordFinished = await prisma.$queryRawUnsafe<any[]>(
      `SELECT message_id, finished_at FROM discord_jobs WHERE organization_id = $1 AND finished_at IS NOT NULL AND finished_at > NOW() - INTERVAL '5 seconds' ORDER BY finished_at DESC LIMIT 5`,
      session.user.organizationId
    )
    const recentDiscordStarted = await prisma.$queryRawUnsafe<any[]>(
      `SELECT message_id FROM discord_jobs WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '2 seconds' ORDER BY created_at DESC`,
      session.user.organizationId
    )

    return NextResponse.json({
      isProcessing: processingEmails > 0 || discord.isProcessing || activeDiscordJobs.length > 0 || recentDiscordStarted.length > 0,
      processingCount: processingEmails + Math.max(discord.processingCount, Math.max(activeDiscordJobs.length, recentDiscordStarted.length)),
      recentlyProcessed: [
        ...recentlyProcessed,
        ...discord.recentlyProcessed.map((r: any) => ({
          id: r.id,
          subject: r.title || 'Discord task(s)',
          fromEmail: 'discord',
          taskId: null,
          createdAt: r.at
        })),
        ...recentDiscordFinished.map((r: any) => ({
          id: r.message_id,
          subject: 'Discord task(s)',
          fromEmail: 'discord',
          taskId: null,
          createdAt: r.finished_at
        }))
      ]
    })
  } catch (error) {
    console.error("Processing status error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}