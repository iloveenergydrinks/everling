import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/login', request.nextUrl.origin))
  }

  // Determine the correct external base URL, even behind proxies
  const getBaseUrl = (req: NextRequest): string => {
    if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL
    if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.nextUrl).host
    return `${proto}://${host}`
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = new URL('/api/integrations/google/callback', getBaseUrl(request)).toString()
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events')

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId || ''
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true&scope=${scope}`

  return NextResponse.redirect(authUrl)
}


