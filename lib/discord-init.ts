import discordBot from './discord-bot'

// Initialize Discord bot on server startup
export async function initializeDiscordBot() {
  if (process.env.DISCORD_BOT_TOKEN) {
    console.log('Initializing Discord bot...')
    try {
      await discordBot.initialize()
      console.log('Discord bot initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error)
    }
  } else {
    console.log('Discord bot token not configured, skipping initialization')
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Discord bot...')
  await discordBot.shutdown()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down Discord bot...')
  await discordBot.shutdown()
  process.exit(0)
})
