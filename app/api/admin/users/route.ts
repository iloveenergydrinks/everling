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

    // Get ALL users across ALL organizations (global view)
    const users = await prisma.user.findMany({
      include: {
        organizations: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        },
        _count: {
          select: {
            tasksCreated: true,
            tasksAssigned: true,
            apiKeys: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to include organization info and stats
    const transformedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      phoneNumber: user.phoneNumber,
      organizations: user.organizations.map(om => om.organization),
      organization: user.organizations[0]?.organization || null, // Primary org for compatibility
      stats: {
        tasksCreated: user._count.tasksCreated,
        tasksAssigned: user._count.tasksAssigned,
        apiKeys: user._count.apiKeys
      }
    }))

    return NextResponse.json(transformedUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}
