import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = new URL('/api/integrations/google/callback', request.nextUrl.origin).toString()
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events')

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId || ''
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true&scope=${scope}`

  return NextResponse.redirect(authUrl)
}


