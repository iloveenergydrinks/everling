import { Client, GatewayIntentBits, Message, ThreadChannel, TextChannel } from 'discord.js'
import { interpretCommand } from './tasks'
import { smartAgent } from './discord-agent'
import prisma from './prisma'
import { startDiscordProcessing, finishDiscordProcessing } from './discord-processing'

interface DiscordContext {
  messages: Array<{
    id: string
    author: {
      id: string
      username: string
      discriminator: string
    }
    content: string
    timestamp: Date
    mentions: string[]
  }>
  channel: {
    id: string
    name: string
    type: 'text' | 'thread'
  }
  guild: {
    id: string
    name: string
  }
}

class DiscordBot {
  private client: Client | null = null
  private botUserId: string | null = null
  private processedMessageIds: Set<string> = new Set()
  private processingInFlight: Set<string> = new Set()
  private lastChannelProcessAt: Map<string, number> = new Map()

  async initialize() {
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.log('Discord bot token not configured')
      return
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
      ]
    })

    this.client.on('ready', () => {
      console.log(`Discord bot logged in as ${this.client?.user?.tag}`)
      console.log(`Bot User ID: ${this.client?.user?.id}`)
      this.botUserId = this.client?.user?.id || null
    })

    this.client.on('messageCreate', async (message: Message) => {
      console.log(`📩 Message received from ${message.author.username}: "${message.content.substring(0, 50)}..."`)
      await this.handleMessage(message)
    })

    await this.client.login(process.env.DISCORD_BOT_TOKEN)
  }

  private async handleMessage(message: Message) {
    // Ignore messages from the bot itself
    if (message.author.bot) {
      console.log('📩 Ignoring bot message')
      return
    }

    console.log(`📩 Bot User ID: ${this.botUserId}, Mentions:`, message.mentions.users.map(u => u.id))
    
    // Check if the bot is mentioned
    if (!message.mentions.has(this.botUserId!)) {
      console.log('📩 Bot not mentioned, ignoring')
      return
    }

    console.log('🎯 Bot was mentioned! Processing...')

    // Hard guard: if we're already processing this message ID, bail
    if (this.processingInFlight.has(message.id)) {
      console.log('⏳ Processing already in-flight for message:', message.id)
      return
    }
    this.processingInFlight.add(message.id)
    try {
      // De-duplicate exact same Discord messages by ID
      if (this.processedMessageIds.has(message.id)) {
        console.log('🧹 Skipping already processed message:', message.id)
        return
      }
      this.processedMessageIds.add(message.id)
      setTimeout(() => this.processedMessageIds.delete(message.id), 10 * 60 * 1000) // keep for 10 minutes

      // Simple per-channel cooldown for empty-mention pings
      const contentStripped = (message.content || '').replace(/<@!?\d+>/g, '').trim()
      const now = Date.now()
      const lastAt = this.lastChannelProcessAt.get(message.channelId) || 0
      if (!contentStripped && now - lastAt < 5000) {
        console.log('⏱️ Cooldown: ignoring duplicate empty mention in channel')
        return
      }
      this.lastChannelProcessAt.set(message.channelId, now)
    
      // Verify the user is authorized
      const authorizedUser = await prisma.user.findFirst({
        where: {
          discordId: message.author.id
        },
        include: {
          organizations: true
        }
      })

      if (!authorizedUser) {
        await message.reply('⚠️ Only authorized users can use this bot. Please connect your Discord account at everling.io')
        return
      }

      // Persisted idempotency: try to record this message as processed. If it already exists, ignore.
      try {
        const inserted = await prisma.$executeRawUnsafe(
          `INSERT INTO discord_processed_messages (message_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          message.id
        )
        if (Number(inserted) === 0) {
          console.log('🛑 Already processed message (DB ledger):', message.id)
          return
        }
      } catch (e) {
        console.warn('Idempotency ledger not available, continuing without DB guard')
      }

      const rawContent = (message.content || '')
      const contentOnly = rawContent.replace(/<@!?\d+>/g, '').trim()
      // Determine mode: single-message by default; thread mode only on explicit ask
      const wantsThread = /\b(context|process(\s+)?above|sopra|riassumi)\b/i.test(contentOnly)

      // Build context
      let context: DiscordContext
      if (wantsThread) {
        // Thread mode: fetch recent messages (small window)
        context = await this.extractContext(message)
        context.messages = context.messages.slice(-10)
      } else {
        // Single-message mode: only the cleaned mention content
        context = {
          messages: [{
            id: message.id,
            author: { id: message.author.id, username: message.author.username, discriminator: message.author.discriminator },
            content: contentOnly,
            timestamp: message.createdAt,
            mentions: []
          }],
          channel: {
            id: message.channel.id,
            name: 'name' in message.channel ? (message.channel as any).name : 'DM',
            type: message.channel.isThread() ? 'thread' : 'text'
          },
          guild: message.guild ? { id: message.guild.id, name: message.guild.name } : { id: 'dm', name: 'Direct Message' }
        }
      }
      
      // Mark processing start (in-memory) and DB-backed job row
      startDiscordProcessing(message.id)
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO discord_jobs (message_id, organization_id, status, meta) VALUES ($1, $2, 'processing', $3) ON CONFLICT (message_id) DO NOTHING`,
          message.id,
          authorizedUser.organizations?.[0]?.organizationId || '',
          JSON.stringify({ channelId: message.channelId })
        )
      } catch {}
      // Process the context to extract tasks for this specific user
      const result = await this.processContext(context, message, authorizedUser.id, {
        singleMessageMode: !wantsThread,
        contentOnly
      })
      
      // Send response back to Discord
      await this.sendResponse(message, result)
      let titles: string[] = []
      if (result.success) {
        if ('tasks' in result && result.tasks) {
          titles = result.tasks.map((t: any) => t.title)
        } else if ('task' in result && result.task) {
          titles = [result.task.title]
        }
      }
      finishDiscordProcessing(message.id, titles)
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE discord_jobs SET status = 'done', finished_at = NOW(), meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('titles', $2) WHERE message_id = $1`,
          message.id,
          JSON.stringify(titles)
        )
      } catch {}
    } catch (error) {
      console.error('Error processing Discord message:', error)
      await message.reply('Sorry, I encountered an error processing this conversation.')
      finishDiscordProcessing(message.id)
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE discord_jobs SET status = 'error', finished_at = NOW() WHERE message_id = $1`,
          message.id
        )
      } catch {}
    } finally {
      this.processingInFlight.delete(message.id)
    }
  }

  private async extractContext(message: Message): Promise<DiscordContext> {
    const channel = message.channel
    const contextMessages = []
    
    // Fetch previous messages for context (last 50 messages)
    const messages = await channel.messages.fetch({ limit: 20, before: message.id })
    
    // Add messages to context (reverse to get chronological order)
    const sortedMessages = Array.from(messages.values()).reverse()
    
    for (const msg of sortedMessages) {
      if (!msg.author.bot) { // Skip bot messages
        contextMessages.push({
          id: msg.id,
          author: {
            id: msg.author.id,
            username: msg.author.username,
            discriminator: msg.author.discriminator
          },
          content: msg.content,
          timestamp: msg.createdAt,
          mentions: msg.mentions.users.map(u => u.username)
        })
      }
    }
    
    // Add the current message
    contextMessages.push({
      id: message.id,
      author: {
        id: message.author.id,
        username: message.author.username,
        discriminator: message.author.discriminator
      },
      content: message.content,
      timestamp: message.createdAt,
      mentions: message.mentions.users.map(u => u.username)
    })
    
    return {
      messages: contextMessages,
      channel: {
        id: channel.id,
        name: 'name' in channel ? (channel.name || 'Unknown') : 'DM',
        type: channel.isThread() ? 'thread' : 'text'
      },
      guild: message.guild ? {
        id: message.guild.id,
        name: message.guild.name
      } : {
        id: 'dm',
        name: 'Direct Message'
      }
    }
  }

  private async processContext(context: DiscordContext, originalMessage: Message, userId: string, opts?: { singleMessageMode?: boolean, contentOnly?: string }) {
    // Build a conversation string from the context
    const conversationText = context.messages
      .map(msg => `${msg.author.username}: ${msg.content}`)
      .join('\n')
    
    // Build a pseudo email thread for better AI extraction (Discord → email-like)
    const threadLike = {
      from: `${originalMessage.author.username}@discord`,
      subject: `Discord: ${context.channel.name}`,
      body: opts?.singleMessageMode ? (opts?.contentOnly || '') : conversationText,
      timestamp: new Date()
    }

    // Extract the command from the original message (remove bot mention)
    const botMention = `<@${this.botUserId}>`
    const command = originalMessage.content.replace(botMention, '').trim()
    
    // Check for specific commands
    if (command.toLowerCase().startsWith('summarize')) {
      return await this.summarizeTasks(context, userId)
    }
    
    if (command.toLowerCase().startsWith('help')) {
      return this.getHelpMessage()
    }
    
    // Default: Extract tasks from the conversation (pass thread-like context)
    const agentResult = await smartAgent({
      content: opts?.singleMessageMode ? (opts?.contentOnly || '') : conversationText,
      subject: opts?.singleMessageMode ? `Discord note in #${context.channel.name}` : `Discord conversation in #${context.channel.name}`,
      from: originalMessage.author.username,
      userId: userId,
      metadata: {
        source: 'discord',
        channelId: context.channel.id,
        guildId: context.guild.id,
        messageId: originalMessage.id,
        threadUrl: originalMessage.url,
        threadLike
      }
    })
    
    return agentResult
  }

  private async summarizeTasks(context: DiscordContext, userId: string) {
    // Get recent tasks created from Discord for this channel
    const tasks = await prisma.task.findMany({
      where: {
        createdById: userId,
        createdVia: 'discord',
        emailMetadata: {
          path: ['channelId'],
          equals: context.channel.id
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    return {
      success: true,
      tasks: tasks,
      message: `Found ${tasks.length} recent tasks from this channel`
    }
  }

  private getHelpMessage() {
    return {
      success: true,
      message: `**Everling Discord Bot Commands:**
• **@Everling** - Extract tasks from the conversation above
• **@Everling summarize** - Show recent tasks from this channel
• **@Everling help** - Show this help message
• **@Everling [task description]** - Quick create a task

**How it works:**
When you mention me, I read the conversation context and intelligently extract tasks, deadlines, and assignments - just like forwarding an email thread!`
    }
  }

  private async sendResponse(message: Message, result: any) {
    if (!result.success) {
      await message.reply(result.message || 'Sorry, I couldn\'t process that.')
      return
    }
    
    // Handle different response types
    if (result.tasks && Array.isArray(result.tasks)) {
      // Multiple tasks created
      const taskList = result.tasks
        .map((task: any) => `• ${task.title}${task.dueDate ? ` (due ${new Date(task.dueDate).toLocaleDateString()})` : ''}`)
        .join('\n')
      
      await message.reply(`✅ Created ${result.tasks.length} task(s):\n${taskList}`)
    } else if (result.task) {
      // Single task created
      await message.reply(`✅ Created task: "${result.task.title}"${result.task.dueDate ? ` (due ${new Date(result.task.dueDate).toLocaleDateString()})` : ''}`)
    } else if (result.message) {
      // Custom message
      await message.reply(result.message)
    } else {
      // Generic success
      await message.reply('✅ Done!')
    }
    
    // Add a reaction to show we processed it
    await message.react('✅')
  }

  async shutdown() {
    if (this.client) {
      await this.client.destroy()
    }
  }
}

// Export singleton instance
const discordBot = new DiscordBot()
export default discordBot
