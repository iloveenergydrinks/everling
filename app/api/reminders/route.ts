import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// GET /api/reminders - Get upcoming reminders
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    // Get tasks with reminders due in the next 24 hours
    const upcomingReminders = await prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        reminderDate: {
          gte: now,
          lte: in24Hours
        },
        reminderSent: false,
        status: {
          notIn: ['done', 'archived']
        }
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            name: true,
            email: true
          }
        },
        reminders: {
          where: {
            sent: false,
            reminderDate: {
              gte: now,
              lte: in24Hours
            }
          }
        }
      },
      orderBy: {
        reminderDate: 'asc'
      }
    })

    // Get overdue reminders (past due but not sent)
    const overdueReminders = await prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        reminderDate: {
          lt: now
        },
        reminderSent: false,
        status: {
          notIn: ['done', 'archived']
        }
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        reminderDate: 'desc'
      },
      take: 10 // Limit overdue reminders to prevent overwhelming
    })

    // Get tasks due soon (within 3 days)
    const dueSoonTasks = await prisma.task.findMany({
      where: {
        organizationId: session.user.organizationId,
        dueDate: {
          gte: now,
          lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
        },
        status: {
          notIn: ['done', 'archived']
        }
      },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    return NextResponse.json({
      upcoming: upcomingReminders,
      overdue: overdueReminders,
      dueSoon: dueSoonTasks,
      summary: {
        upcomingCount: upcomingReminders.length,
        overdueCount: overdueReminders.length,
        dueSoonCount: dueSoonTasks.length,
        totalPending: upcomingReminders.length + overdueReminders.length
      }
    })
  } catch (error) {
    console.error("Error fetching reminders:", error)
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    )
  }
}

// POST /api/reminders/mark-sent - Mark reminders as sent
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { taskId, reminderId } = await request.json()
    
    if (taskId) {
      // Mark task reminder as sent
      await prisma.task.update({
        where: {
          id: taskId,
          organizationId: session.user.organizationId
        },
        data: {
          reminderSent: true
        }
      })
    }
    
    if (reminderId) {
      // Mark specific reminder as sent
      await prisma.taskReminder.update({
        where: {
          id: reminderId
        },
        data: {
          sent: true,
          sentAt: new Date()
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error marking reminder as sent:", error)
    return NextResponse.json(
      { error: "Failed to update reminder" },
      { status: 500 }
    )
  }
}

