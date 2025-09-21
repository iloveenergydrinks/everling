import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Establish base URL consistently with start route
    const getBaseUrl = (req: NextRequest): string => {
      if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL
      if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
      const proto = req.headers.get('x-forwarded-proto') || 'https'
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.nextUrl).host
      return `${proto}://${host}`
    }

    const code = request.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(new URL('/dashboard?google=error', request.nextUrl.origin))
    }

    const redirectUri = new URL('/api/integrations/google/callback', getBaseUrl(request)).toString()
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString()
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL('/dashboard?google=error', request.nextUrl.origin))
    }
    const token = await tokenRes.json()
    const refreshToken = token.refresh_token as string | undefined
    const accessToken = token.access_token as string | undefined

    // Persist tokens on the current authenticated user
    const session = await getServerSession(authOptions)
    if (session?.user?.id && refreshToken) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          calendarProvider: 'google',
          googleRefreshToken: refreshToken,
          calendarAutoPush: true
        }
      })
    }

    const url = new URL('/dashboard', getBaseUrl(request))
    if (refreshToken) url.searchParams.set('google', 'connected')
    else url.searchParams.set('google', 'partial')
    return NextResponse.redirect(url)
  } catch (e) {
    return NextResponse.redirect(new URL('/dashboard?google=error', request.nextUrl.origin))
  }
}


