import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

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
      slug: organization.slug,
      emailPrefix: organization.emailPrefix,
      plan: organization.plan || "free",
      taskLimit: organization.taskLimit || 100,
      monthlyTasksUsed: organization.monthlyTasksUsed || 0,
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

// PATCH /api/organization - Update organization details
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is admin
    if (session.user.organizationRole !== 'admin') {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      )
    }

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        slug: true,
        emailPrefix: true,
        plan: true,
        taskLimit: true,
        monthlyTasksUsed: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json(updated)

  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    )
  }
}
