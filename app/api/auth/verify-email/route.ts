import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/email-verification'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(
        new URL('/login?error=InvalidToken', request.url)
      )
    }

    // Verify the token
    const result = await verifyToken(token)
    
    if (!result) {
      return NextResponse.redirect(
        new URL('/login?error=TokenExpired', request.url)
      )
    }

    // Update user's emailVerified status
    await prisma.user.update({
      where: { email: result.email },
      data: { emailVerified: new Date() }
    })

    // Redirect to sign in page with success message
    return NextResponse.redirect(
      new URL('/login?verified=true', request.url)
    )
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.redirect(
      new URL('/login?error=VerificationFailed', request.url)
    )
  }
}
