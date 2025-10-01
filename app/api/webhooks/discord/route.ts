import { NextRequest, NextResponse } from "next/server"
import nacl from "tweetnacl"
import prisma from "@/lib/prisma"
import { smartAgent } from "@/lib/discord-agent"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Verify Discord webhook signature using Ed25519
function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const message = timestamp + body
    const messageBytes = Buffer.from(message)
    const signatureBytes = Buffer.from(signature, 'hex')
    const publicKeyBytes = Buffer.from(publicKey, 'hex')
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('X-Signature-Ed25519')
    const timestamp = req.headers.get('X-Signature-Timestamp')
    
    // Parse the interaction first to check if it's a verification ping
    const interaction = JSON.parse(body)
    
    // For Discord verification ping, check signature if headers are present
    if (interaction.type === 1) {
      // If this is a verification ping and we have signature headers, verify them
      if ((signature || timestamp) && process.env.DISCORD_PUBLIC_KEY) {
        const isValid = verifyDiscordSignature(
          body,
          signature!,
          timestamp!,
          process.env.DISCORD_PUBLIC_KEY
        )
        
        if (!isValid) {
          console.log('Invalid signature for verification ping')
          console.log('Signature:', signature?.substring(0, 20) + '...')
          console.log('Timestamp:', timestamp)
          console.log('Public key:', process.env.DISCORD_PUBLIC_KEY?.substring(0, 20) + '...')
          console.log('Body:', body.substring(0, 100))
          return NextResponse.json({ error: 'invalid_request_signature' }, { status: 401 })
        }
      }
      
      console.log('Discord verification ping received and validated')
      return NextResponse.json({ type: 1 })
    }
    
    // For all other interactions, require signature verification if public key is set
    if (process.env.DISCORD_PUBLIC_KEY && process.env.DISCORD_PUBLIC_KEY !== '') {
      if (!signature || !timestamp) {
        console.log('Missing signature headers for interaction')
        return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
      }
      
      const isValid = verifyDiscordSignature(
        body,
        signature,
        timestamp,
        process.env.DISCORD_PUBLIC_KEY
      )
      
      if (!isValid) {
        console.log('Invalid signature for interaction')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.log('⚠️ WARNING: DISCORD_PUBLIC_KEY not configured - signature verification skipped')
    }
    
    // Handle slash commands
    if (interaction.type === 2) {
      console.log(`📌 Slash command received: ${interaction.data?.name}`)
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
  const { data, member, user } = interaction
  const command = data.name
  const options = data.options || []
  
  console.log(`[Discord] Handling slash command: ${command}`)

  // Get the Discord user
  const discordUser = member?.user || user
  
  console.log(`[Discord] User ID: ${discordUser.id}, Username: ${discordUser.username}`)

  // Find the linked user account
  const linkedUser = await prisma.user.findFirst({
    where: {
      OR: [
        { discordId: discordUser.id },
        { discordUserId: discordUser.id },
        { email: `${discordUser.username}@discord` }
      ]
    }
  })

  if (!linkedUser) {
    console.log(`[Discord] User not linked: ${discordUser.id}`)
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ Please link your Discord account in Everling settings first.",
        flags: 64 // Ephemeral message
      }
    })
  }
  
  console.log(`[Discord] Linked user found: ${linkedUser.email}`)

  // Always defer ephemeral, then follow up asynchronously
  ;(async () => {
    const startTime = Date.now()
    try {
      switch (command) {
        case 'task': {
          const description = options?.find((o: any) => o.name === 'description')?.value
          const due = options?.find((o: any) => o.name === 'due')?.value
          const priority = options?.find((o: any) => o.name === 'priority')?.value || 'medium'

          if (!description) {
            await sendFollowup(interaction, { content: "❌ Please provide a task description", flags: 64 })
            break
          }

          const enrichedContent = `${description}${priority === 'high' ? ' [high priority]' : ''}${due ? ` [due ${due}]` : ''}`

          try {
            console.log(`[Discord] Creating task with content: ${enrichedContent}`)
            const result = await smartAgent({
              content: enrichedContent,
              subject: `Quick task from Discord`,
              from: discordUser?.username || 'Discord User',
              metadata: {
                source: 'discord',
                channelId: interaction.channel_id,
                guildId: interaction.guild_id,
                messageId: interaction.id
              },
              userId: linkedUser.id
            })

            console.log(`[Discord] Task creation result:`, JSON.stringify(result))
            
            if (result.success && result.task) {
              await sendFollowup(interaction, {
                content: `✅ Created task: **${result.task.title}**${result.task.dueDate ? `\n📅 Due: ${new Date(result.task.dueDate).toLocaleDateString()}` : ''}`,
                flags: 64
              })
            } else if (result.success && result.tasks && result.tasks.length > 0) {
              const taskList = result.tasks.map((t: any, i: number) => `${i + 1}. ${t.title}${t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString()})` : ''}`).join('\n')
              await sendFollowup(interaction, {
                content: `✅ Created ${result.tasks.length} task(s):\n${taskList}`,
                flags: 64
              })
            } else {
              const errorMsg = result.message || "Failed to create task"
              console.error(`[Discord] Task creation failed:`, errorMsg)
              await sendFollowup(interaction, { content: `❌ ${errorMsg}`, flags: 64 })
            }
          } catch (error: any) {
            console.error(`[Discord] Task creation error:`, error)
            await sendFollowup(interaction, { 
              content: `❌ Error creating task: ${error.message || 'Unknown error'}`, 
              flags: 64 
            })
          }
          break
        }

        case 'tasks': {
          const tasks = await prisma.task.findMany({
            where: {
              createdById: linkedUser.id,
              status: 'todo'
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          })

          if (tasks.length === 0) {
            await sendFollowup(interaction, { content: "📋 You have no pending tasks", flags: 64 })
          } else {
            const taskList = tasks.map((task, index) => `**${index + 1}.** ${task.title}${task.dueDate ? ` (due ${new Date(task.dueDate).toLocaleDateString()})` : ''}`).join('\n')
            await sendFollowup(interaction, { content: `📋 **Your pending tasks:**\n${taskList}`, flags: 64 })
          }
          break
        }

        case 'everling': {
          const sub = options?.[0]?.name
          if (sub === 'help') {
            await sendFollowup(interaction, { content: `**Everling Discord Commands:**\n📝 **/task** - Create a quick task\n📋 **/tasks** - View your pending tasks\n🤖 **/everling context** - Extract tasks from recent messages\n❓ **/everling help** - Show this help message`, flags: 64 })
          } else if (sub === 'context') {
            await sendFollowup(interaction, { content: `Processing recent conversation... You'll receive a DM if tasks are detected.`, flags: 64 })
          } else {
            await sendFollowup(interaction, { content: "Use `/everling help` to see available commands", flags: 64 })
          }
          break
        }

        case 'digest': {
          console.log(`[Discord] Starting digest for user ${linkedUser.email}`)
          // Build an ephemeral digest-like response with timeout protection
          const digestTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Digest timeout')), 2500)
          )
          
          try {
            const queryStartTime = Date.now()
            const digestData = await Promise.race([
              (async () => {
                const today = new Date(); today.setHours(0, 0, 0, 0)
                const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

                // Run both queries in parallel for speed
                const [tasks, totalPending] = await Promise.all([
                  prisma.task.findMany({
                    where: {
                      createdById: linkedUser.id,
                      status: { not: 'done' },
                      OR: [
                        { dueDate: { gte: today, lt: tomorrow } },
                        { reminderDate: { gte: today, lt: tomorrow } }
                      ]
                    },
                    orderBy: [
                      { priority: 'desc' },
                      { dueDate: 'asc' },
                      { reminderDate: 'asc' }
                    ],
                    take: 10
                  }),
                  prisma.task.count({
                    where: { createdById: linkedUser.id, status: { not: 'done' } }
                  })
                ])
                
                return { tasks, totalPending }
              })(),
              digestTimeout
            ])
            
            console.log(`[Discord] Digest queries completed in ${Date.now() - queryStartTime}ms`)
            const { tasks, totalPending } = digestData as any
            
            let content = "📋 **Your Task Digest**\n\n"
            if (tasks.length === 0) {
              content += "You have no tasks due today."
            } else {
              content += tasks.map((t: any, i: number) => `${i + 1}. ${t.title}${t.dueDate ? ` (due ${new Date(t.dueDate).toLocaleDateString()})` : ''}`).join('\n')
              if (totalPending > tasks.length) {
                content += `\n\n+${totalPending - tasks.length} more pending task(s)`
              }
            }
            
            console.log(`[Discord] Sending digest follow-up with ${tasks.length} tasks`)
            await sendFollowup(interaction, { content, flags: 64 })
            console.log(`[Discord] Digest follow-up sent successfully`)
          } catch (err: any) {
            console.error('Digest command error:', err.message || err)
            // Send a simpler fallback response
            await sendFollowup(interaction, { 
              content: "📋 Fetching your digest... Please check your dashboard at https://everling.io/dashboard", 
              flags: 64 
            })
          }
          break
        }

        default: {
          await sendFollowup(interaction, { content: "Unknown command", flags: 64 })
        }
      }
    } catch (err) {
      console.error('Slash command follow-up error:', err)
      try { await sendFollowup(interaction, { content: '❌ An error occurred while processing your command.', flags: 64 }) } catch {}
    } finally {
      const duration = Date.now() - startTime
      console.log(`[Discord] Command ${command} completed in ${duration}ms`)
    }
  })()

  // Defer ephemeral response immediately
  console.log(`[Discord] Sending deferred response for ${command}`)
  return NextResponse.json({
    type: 5,
    data: { flags: 64 }
  })
}

// Helper: send follow-up message after a deferred reply
async function sendFollowup(interaction: any, data: { content?: string; embeds?: any; flags?: number }) {
  const url = `https://discord.com/api/webhooks/${interaction.application_id}/${interaction.token}`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: data.content,
        embeds: data.embeds,
        flags: typeof data.flags === 'number' ? data.flags : 64
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Discord follow-up failed: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Discord API error: ${response.status}`)
    }
    
    return response
  } catch (error) {
    console.error('Error sending Discord follow-up:', error)
    throw error
  }
}

// (old handleTasksListCommand inlined into deferred follow-up flow)

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
