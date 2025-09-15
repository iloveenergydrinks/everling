import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/email-verification'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Always use the correct base URL for redirects
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://everling.io'
    : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
    
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/login?error=InvalidToken', baseUrl)
      )
    }

    // Verify the token
    const result = await verifyToken(token)
    
    if (!result) {
      return NextResponse.redirect(
        new URL('/login?error=TokenExpired', baseUrl)
      )
    }

    // Update user's emailVerified status
    await prisma.user.update({
      where: { email: result.email },
      data: { emailVerified: new Date() }
    })

    // Redirect to sign in page with success message
    return NextResponse.redirect(
      new URL('/login?verified=true', baseUrl)
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.redirect(
      new URL('/login?error=VerificationFailed', baseUrl)
    )
  }
}
