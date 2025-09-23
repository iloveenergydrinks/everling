import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Remove Discord connection from user
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        discordId: null,
        discordUsername: null,
        discordConnected: null,
      },
    })
    
    return NextResponse.json({ success: true, message: 'Discord disconnected successfully' })
  } catch (error) {
    console.error('Discord disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Discord' }, { status: 500 })
  }
}
