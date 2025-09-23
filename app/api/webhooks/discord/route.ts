import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import prisma from "@/lib/prisma"
import { smartAgent } from "@/lib/discord-agent"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Verify Discord webhook signature
function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const message = timestamp + body
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(message)
    verify.end()
    return verify.verify(
      `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
      signature,
      'hex'
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('X-Signature-Ed25519')
    const timestamp = req.headers.get('X-Signature-Timestamp')
    
    // Verify the request is from Discord
    if (process.env.DISCORD_PUBLIC_KEY) {
      if (!signature || !timestamp) {
        return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
      }
      
      const isValid = verifyDiscordSignature(
        body,
        signature,
        timestamp,
        process.env.DISCORD_PUBLIC_KEY
      )
      
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }
    
    const interaction = JSON.parse(body)
    
    // Handle Discord ping (verification)
    if (interaction.type === 1) {
      return NextResponse.json({ type: 1 })
    }
    
    // Handle slash commands
    if (interaction.type === 2) {
      return await handleSlashCommand(interaction)
    }
    
    // Handle message components (buttons, select menus, etc.)
    if (interaction.type === 3) {
      return await handleMessageComponent(interaction)
    }
    
    return NextResponse.json({ error: 'Unknown interaction type' }, { status: 400 })
  } catch (error) {
    console.error('Discord webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleSlashCommand(interaction: any) {
  const { data, member, user, channel_id, guild_id } = interaction
  const command = data.name
  const options = data.options || []
  
  // Get the Discord user
  const discordUser = member?.user || user
  
  // Find the linked user account
  const linkedUser = await prisma.user.findFirst({
    where: {
      OR: [
        { discordId: discordUser.id },
        { email: `${discordUser.username}@discord` }
      ]
    }
  })
  
  if (!linkedUser) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ Please link your Discord account in Everling settings first.",
        flags: 64 // Ephemeral message
      }
    })
  }
  
  switch (command) {
    case 'task':
      return await handleTaskCommand(interaction, linkedUser)
    
    case 'tasks':
      return await handleTasksListCommand(interaction, linkedUser)
    
    case 'everling':
      return await handleEverlingCommand(interaction, linkedUser)
    
    default:
      return NextResponse.json({
        type: 4,
        data: {
          content: "Unknown command",
          flags: 64
        }
      })
  }
}

async function handleTaskCommand(interaction: any, user: any) {
  const description = interaction.data.options?.find((o: any) => o.name === 'description')?.value
  const due = interaction.data.options?.find((o: any) => o.name === 'due')?.value
  const priority = interaction.data.options?.find((o: any) => o.name === 'priority')?.value || 'medium'
  
  if (!description) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ Please provide a task description",
        flags: 64
      }
    })
  }
  
  // Use smart agent to process the task
  const result = await smartAgent({
    content: description,
    subject: `Quick task from Discord`,
    from: interaction.member?.user?.username || interaction.user?.username || 'Discord User',
    metadata: {
      source: 'discord',
      channelId: interaction.channel_id,
      guildId: interaction.guild_id,
      interactionId: interaction.id,
      priority: priority,
      dueDate: due
    },
    userId: user.id
  })
  
  if (result.success && result.task) {
    return NextResponse.json({
      type: 4,
      data: {
        content: `✅ Created task: **${result.task.title}**${result.task.dueDate ? `\n📅 Due: ${new Date(result.task.dueDate).toLocaleDateString()}` : ''}`,
        flags: 0 // Visible to everyone
      }
    })
  } else {
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ Failed to create task. Please try again.",
        flags: 64
      }
    })
  }
}

async function handleTasksListCommand(interaction: any, user: any) {
  // Get recent tasks for this user
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: 'pending'
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  
  if (tasks.length === 0) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "📋 You have no pending tasks",
        flags: 64
      }
    })
  }
  
  const taskList = tasks.map((task, index) => 
    `**${index + 1}.** ${task.title}${task.dueDate ? ` (due ${new Date(task.dueDate).toLocaleDateString()})` : ''}`
  ).join('\n')
  
  return NextResponse.json({
    type: 4,
    data: {
      content: `📋 **Your pending tasks:**\n${taskList}`,
      flags: 64
    }
  })
}

async function handleEverlingCommand(interaction: any, user: any) {
  const subcommand = interaction.data.options?.[0]?.name
  
  switch (subcommand) {
    case 'help':
      return NextResponse.json({
        type: 4,
        data: {
          content: `**Everling Discord Commands:**
📝 **/task** - Create a quick task
📋 **/tasks** - View your pending tasks
🤖 **/everling context** - Extract tasks from recent messages
❓ **/everling help** - Show this help message

**How it works:**
Everling can read your Discord conversations and intelligently extract tasks, deadlines, and assignments - just like forwarding an email thread!`,
          flags: 64
        }
      })
    
    case 'context':
      // Defer the response as this might take time
      return NextResponse.json({
        type: 5, // Deferred response
        data: {
          flags: 64
        }
      })
      // The actual context processing will be handled by a follow-up
    
    default:
      return NextResponse.json({
        type: 4,
        data: {
          content: "Use `/everling help` to see available commands",
          flags: 64
        }
      })
  }
}

async function handleMessageComponent(interaction: any) {
  // Handle button clicks, select menus, etc.
  const { custom_id, values } = interaction.data
  
  // Example: Task completion button
  if (custom_id.startsWith('complete_task_')) {
    const taskId = custom_id.replace('complete_task_', '')
    
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'completed' }
    })
    
    return NextResponse.json({
      type: 7, // Update message
      data: {
        content: `✅ Task completed!`,
        components: [] // Remove buttons
      }
    })
  }
  
  return NextResponse.json({
    type: 4,
    data: {
      content: "Component interaction received",
      flags: 64
    }
  })
}
