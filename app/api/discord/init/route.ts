import { NextRequest, NextResponse } from 'next/server'

// Initialize Discord bot on first API call
let initialized = false
let discordBot: any = null

export async function GET(req: NextRequest) {
  // Only run on server side
  if (typeof window !== 'undefined') {
    return NextResponse.json({ 
      status: 'Discord bot can only run on server',
      online: false 
    })
  }

  // Support force re-initialization without restarting the dev server
  const force = req.nextUrl.searchParams.get('force')
  if (force && initialized && discordBot) {
    try {
      await discordBot.shutdown()
      initialized = false
      discordBot = null
      console.log('Discord bot shut down (force=true). Reinitializing...')
    } catch (err) {
      console.error('Failed to shutdown Discord bot on force refresh:', err)
    }
  }

  if (!initialized && process.env.DISCORD_BOT_TOKEN) {
    try {
      // Dynamically import Discord bot to ensure it's only loaded on server
      const { default: bot } = await import('@/lib/discord-bot')
      discordBot = bot
      await discordBot.initialize()
      initialized = true
      console.log('Discord bot initialized successfully')
      return NextResponse.json({ 
        status: 'Discord bot initialized',
        online: true 
      })
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error)
      return NextResponse.json({ 
        status: 'Failed to initialize Discord bot',
        error: error instanceof Error ? error.message : 'Unknown error',
        online: false 
      }, { status: 500 })
    }
  }
  
  return NextResponse.json({ 
    status: initialized ? 'Discord bot already running' : 'Discord bot not configured',
    online: initialized 
  })
}
