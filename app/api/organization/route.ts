import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/organization - Get organization details
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: {
        id: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            tasks: true,
            members: true,
            emailLogs: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      emailPrefix: organization.emailPrefix,
      plan: "Free", // You can add a plan field to the Organization model later
      taskLimit: 100, // You can make this configurable
      tasksCreated: organization._count.tasks,
      membersCount: organization._count.members,
      emailsProcessed: organization._count.emailLogs,
      createdAt: organization.createdAt,
    })
  } catch (error) {
    console.error("Error fetching organization:", error)
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    )
  }
}
