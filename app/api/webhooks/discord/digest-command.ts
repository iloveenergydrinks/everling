import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function handleDigestCommand(interaction: any) {
  const userId = interaction.member?.user?.id || interaction.user?.id
  
  if (!userId) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ Could not identify Discord user",
        flags: 64 // Ephemeral
      }
    })
  }
  
  try {
    // Find user by Discord ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { discordUserId: userId },
          { discordId: userId }
        ]
      }
    })
    
    if (!user) {
      return NextResponse.json({
        type: 4,
        data: {
          content: "❌ Your Discord account is not linked. Please connect Discord in the Everling dashboard first.\n\nVisit: https://everling.io/dashboard",
          flags: 64 // Ephemeral
        }
      })
    }
    
    // Get today's tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const tasks = await prisma.task.findMany({
      where: {
        createdById: user.id,
        status: { not: 'done' },
        OR: [
          {
            dueDate: {
              gte: today,
              lt: tomorrow
            }
          },
          {
            reminderDate: {
              gte: today,
              lt: tomorrow
            }
          }
        ]
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { reminderDate: 'asc' }
      ],
      take: 10
    })
    
    // Get all pending tasks count
    const totalPending = await prisma.task.count({
      where: {
        createdById: user.id,
        status: { not: 'done' }
      }
    })
    
    // Build response content
    let content = "📋 **Your Task Digest**\n\n"
    
    if (tasks.length === 0) {
      content += "🌟 No tasks scheduled for today. You're all caught up!"
    } else {
      content += `You have **${tasks.length}** task${tasks.length === 1 ? '' : 's'} for today:\n\n`
      
      tasks.forEach((task, index) => {
        const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'
        const time = task.dueDate || task.reminderDate
        const timeStr = time ? `⏰ ${new Date(time).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}` : ''
        
        content += `**${index + 1}.** ${priority} **${task.title}**\n`
        if (task.description) {
          content += `   ${task.description}\n`
        }
        if (timeStr) {
          content += `   ${timeStr}\n`
        }
        content += '\n'
      })
    }
    
    if (totalPending > tasks.length) {
      content += `\n📊 Total pending tasks: **${totalPending}**`
    }
    
    content += `\n\n💡 *Tip: Use \`/setchannel\` to receive daily digests automatically!*`
    
    return NextResponse.json({
      type: 4,
      data: {
        content: content,
        flags: 64 // Ephemeral
      }
    })
    
  } catch (error: any) {
    console.error('Error in digest command:', error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ An error occurred while fetching your digest. Please try again or use `@Everling digest`",
        flags: 64 // Ephemeral
      }
    })
  }
}

// Original complex digest logic (kept for reference but not used)
async function getFullDigest(userId: string) {
  try {
    // Find user by Discord ID with a simpler query
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { discordUserId: userId },
          { discordId: userId }
        ]
      },
      select: {
        id: true,
        discordUserId: true
      }
    })
    
    if (!user) {
      return null
    }
    
    // Get today's tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const tasks = await prisma.task.findMany({
      where: {
        createdById: user.id,
        status: { not: 'done' },
        OR: [
          {
            dueDate: {
              gte: today,
              lt: tomorrow
            }
          },
          {
            reminderDate: {
              gte: today,
              lt: tomorrow
            }
          }
        ]
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { reminderDate: 'asc' }
      ],
      take: 10
    })
    
    // Build embed
    const embed: any = {
      color: 0x0066cc,
      title: '📋 Your Tasks for Today',
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Everling Task Manager'
      }
    }
    
    if (tasks.length === 0) {
      embed.description = '🌅 No tasks scheduled for today. Enjoy your day!'
    } else {
      embed.description = `You have **${tasks.length}** task${tasks.length === 1 ? '' : 's'} for today:`
      embed.fields = tasks.map((task, index) => {
        const time = task.dueDate || task.reminderDate
        const timeStr = time ? new Date(time).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }) : ''
        const priority = task.priority === 'high' ? '⚡' : ''
        const status = task.status === 'in-progress' ? '🔄' : '⏳'
        
        return {
          name: `${index + 1}. ${task.title} ${priority}`,
          value: `${task.description || 'No description'}\n${timeStr ? `⏰ ${timeStr}` : ''} ${status}`,
          inline: false
        }
      })
    }
    
    // Get pending task count
    const totalPending = await prisma.task.count({
      where: {
        createdById: user.id,
        status: { not: 'done' }
      }
    })
    
    if (totalPending > tasks.length) {
      embed.fields = embed.fields || []
      embed.fields.push({
        name: `➕ ${totalPending - tasks.length} more pending tasks`,
        value: `[View all in dashboard](${process.env.NEXT_PUBLIC_APP_URL}/dashboard)`,
        inline: false
      })
    }
    
    return NextResponse.json({
      type: 4,
      data: {
        embeds: [embed],
        flags: 64 // Ephemeral - only visible to the user who ran the command
      }
    })
  } catch (error: any) {
    console.error('Error in digest command:', error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ An error occurred while fetching your digest. Please try again later.",
        flags: 64 // Ephemeral
      }
    })
  }
}
