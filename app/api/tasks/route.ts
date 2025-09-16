import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { getSmartTaskList, interpretCommand } from "@/lib/tasks"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)

    if (!auth.authenticated || !auth.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")
    const smart = searchParams.get("smart") === "true"
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined
    const status = searchParams.get("status")
    const assignedToId = searchParams.get("assignedTo")

    const dbTasks = await prisma.task.findMany({
      where: {
        organizationId: auth.organizationId,
        ...(status && { status }),
        ...(assignedToId && { assignedToId })
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Convert dates to strings for compatibility with our Task interface
    const tasks = dbTasks.map(task => ({
      ...task,
      dueDate: task.dueDate?.toISOString() || null,
      reminderDate: task.reminderDate?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      // Include relationship fields
      assignedToEmail: task.assignedToEmail,
      assignedByEmail: task.assignedByEmail,
      taskType: task.taskType,
      userRole: task.userRole,
      stakeholders: task.stakeholders
    }))

    // Apply smart filtering/ordering if requested
    if (query) {
      // Interpret natural language query
      const filteredTasks = interpretCommand(query, tasks)
      return NextResponse.json(filteredTasks)
    } else if (smart) {
      // Apply smart relevance ordering
      const smartTasks = getSmartTaskList(tasks, limit || 100)
      return NextResponse.json(smartTasks)
    }

    return NextResponse.json(tasks)

  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)

    if (!auth.authenticated || !auth.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { title, description, priority, dueDate, assignedToId } = body

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }

    const task = await prisma.task.create({
      data: {
        organizationId: auth.organizationId,
        title,
        description,
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId,
        createdById: auth.userId,
        createdVia: 'web'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Update organization task count
    await prisma.organization.update({
      where: { id: auth.organizationId },
      data: { tasksCreated: { increment: 1 } }
    })

    return NextResponse.json(task)

  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}
