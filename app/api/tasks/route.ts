import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { getSmartTaskList, interpretCommand } from "@/lib/tasks"
import { upsertGoogleCalendarEvent } from "@/lib/google-calendar"

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
    const filter = searchParams.get("filter") // 'assigned', 'created', 'all'

    // Get the current user's ID for filtering
    let currentUserId: string | null = null
    if (auth.userId) {
      currentUserId = auth.userId
    }

    // Build the where clause based on visibility rules
    let whereClause: any = {
      organizationId: auth.organizationId,
      ...(status && { status })
    }

    // Apply visibility rules - users can only see:
    // 1. Tasks they created (any visibility)
    // 2. Tasks assigned to them
    // 3. Tasks shared with them (in sharedWith array)
    // 4. Team tasks (visibility = 'team')
    
    if (currentUserId) {
      // Default visibility filter (what user can see)
      const visibilityConditions = [
        { createdById: currentUserId }, // Tasks I created
        { assignedToId: currentUserId }, // Tasks assigned to me
        { sharedWith: { has: currentUserId } }, // Tasks shared with me
        { visibility: 'team' } // Team-wide tasks
      ]
      
      // Apply additional filters based on query params
      if (filter === 'assigned') {
        // Only tasks assigned to me
        whereClause.assignedToId = currentUserId
      } else if (filter === 'created') {
        // Only tasks I created
        whereClause.createdById = currentUserId
      } else if (filter === 'team') {
        // Only team-visible tasks
        whereClause.visibility = 'team'
      } else if (filter === 'shared') {
        // Tasks shared with me (not assigned, not created by me)
        whereClause.AND = [
          { sharedWith: { has: currentUserId } },
          { createdById: { not: currentUserId } },
          { assignedToId: { not: currentUserId } }
        ]
      } else {
        // Default: Show all tasks user has access to
        whereClause.OR = visibilityConditions
      }
    } else {
      // No user ID (shouldn't happen with auth), show only team tasks
      whereClause.visibility = 'team'
    }

    const dbTasks = await prisma.task.findMany({
      where: whereClause,
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
    const { 
      title, 
      description, 
      priority, 
      dueDate, 
      reminderDate,
      assignedToId,
      assignedToEmail,
      assignedByEmail,
      taskType,
      userRole,
      emailMetadata,
      stakeholders,
      createdVia
    } = body

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }

    // Check monthly task limit
    const { canCreateTask, incrementMonthlyTaskCount } = await import('@/lib/monthly-limits')
    const limitCheck = await canCreateTask(auth.organizationId)
    
    if (!limitCheck.canCreate) {
      return NextResponse.json(
        { 
          error: "Monthly task limit reached",
          details: {
            used: limitCheck.used,
            limit: limitCheck.limit,
            resetsIn: limitCheck.resetsIn,
            message: `You've reached your monthly limit of ${limitCheck.limit} tasks. Upgrade to Pro for unlimited tasks or wait for reset ${limitCheck.resetsIn}.`
          }
        },
        { status: 403 }
      )
    }

    const task = await prisma.task.create({
      data: {
        organizationId: auth.organizationId,
        title,
        description,
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        assignedToId,
        assignedToEmail,
        assignedByEmail,
        taskType,
        userRole,
        emailMetadata,
        stakeholders,
        createdById: auth.userId,
        createdVia: createdVia || 'web'
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

    // Update organization task count (both total and monthly)
    await incrementMonthlyTaskCount(auth.organizationId)

  // Fire-and-forget push to Google Calendar if enabled
  if (task.dueDate) {
    ;(async () => {
      try { await upsertGoogleCalendarEvent(auth.userId as string, task.id) } catch {}
    })()
  }

    return NextResponse.json(task)

  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    )
  }
}
