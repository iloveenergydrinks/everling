import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createVerificationToken, sendVerificationEmail } from '@/lib/email-verification'

export const dynamic = 'force-dynamic'

// Rate limit: 3 emails per hour per IP
const resendLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3 })

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Rate limit by IP
    const ip = getClientIp(request)
    const rl = await resendLimiter(`resend:${ip}`)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((rl.reset.getTime() - Date.now()) / 1000).toString() } }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Don't reveal whether a user exists
      return NextResponse.json({ ok: true })
    }

    if (user.emailVerified) {
      // Already verified
      return NextResponse.json({ ok: true })
    }

    // Create and send verification token
    const token = await createVerificationToken(email)
    await sendVerificationEmail(email, token, user.name || undefined)

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}


