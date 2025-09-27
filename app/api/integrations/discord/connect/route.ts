import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    if (!process.env.DISCORD_CLIENT_ID) {
      return NextResponse.json({ error: 'Discord not configured' }, { status: 500 })
    }
    
    // Discord OAuth URL
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/discord/callback`,
      response_type: 'code',
      scope: 'identify guilds guilds.join',
      state: session.user.email // Use email as state for security
    })
    
    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`
    
    // Redirect to Discord OAuth
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Discord connect error:', error)
    return NextResponse.json({ error: 'Failed to initialize Discord connection' }, { status: 500 })
  }
}
