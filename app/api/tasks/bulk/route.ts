import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { action, taskIds } = await request.json()

    if (!action || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Provide action and taskIds array." },
        { status: 400 }
      )
    }

    // Validate that all tasks belong to the user's organization
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        organizationId: session.user.organizationId
      },
      select: {
        id: true,
        title: true,
        status: true
      }
    })

    if (tasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: "Some tasks not found or unauthorized" },
        { status: 403 }
      )
    }

    let result
    
    switch (action) {
      case 'delete':
        result = await prisma.task.deleteMany({
          where: {
            id: { in: taskIds },
            organizationId: session.user.organizationId
          }
        })
        break
        
      case 'complete':
        result = await prisma.task.updateMany({
          where: {
            id: { in: taskIds },
            organizationId: session.user.organizationId
          },
          data: {
            status: 'done'
          }
        })
        break
        
      case 'archive':
        result = await prisma.task.updateMany({
          where: {
            id: { in: taskIds },
            organizationId: session.user.organizationId
          },
          data: {
            status: 'archived'
          }
        })
        break
        
      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'delete', 'complete', or 'archive'" },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      count: result.count,
      tasks: tasks.map(t => ({ id: t.id, title: t.title }))
    })

  } catch (error) {
    console.error("Bulk task operation error:", error)
    return NextResponse.json(
      { error: "Failed to perform bulk operation" },
      { status: 500 }
    )
  }
}
