import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { createVerificationToken, sendVerificationEmail } from "@/lib/email-verification"

// Stricter rate limit for registration: 3 attempts per hour per IP
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3 // Only 3 registration attempts per hour
})

// List of disposable email domains to block
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com',
  'getairmail.com', 'fakeinbox.com', 'dispostable.com', 'mailnesia.com'
]

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return DISPOSABLE_EMAIL_DOMAINS.some(d => domain?.includes(d))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, organizationName } = body

    // Validate input
    if (!email || !password || !organizationName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check rate limit
    const clientIp = getClientIp(request)
    const rateLimitResult = await registrationRateLimit(clientIp)
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: "Too many registration attempts. Please try again later.",
          retryAfter: rateLimitResult.reset.toISOString()
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString()
          }
        }
      )
    }

    // Block disposable emails
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Please use a permanent email address" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Generate organization slug
    let slug = slugify(organizationName)
    let emailPrefix = slug
    let counter = 1

    // Ensure unique slug and email prefix
    while (true) {
      const existing = await prisma.organization.findFirst({
        where: {
          OR: [
            { slug: slug },
            { emailPrefix: emailPrefix }
          ]
        }
      })

      if (!existing) break

      slug = `${slugify(organizationName)}-${counter}`
      emailPrefix = slug
      counter++
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user and organization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          emailPrefix,
        }
      })

      // Create user (unverified by default)
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          emailVerified: null, // User must verify email before they can login
        }
      })

      // Add user as admin of organization
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'admin'
        }
      })

      // Auto-add registration email to allowed emails
      await tx.allowedEmail.create({
        data: {
          organizationId: organization.id,
          email: email.toLowerCase(),
          addedById: user.id,
          note: 'Registration email',
        }
      })

      return { user, organization }
    })

    // Send verification email
    try {
      const token = await createVerificationToken(email)
      await sendVerificationEmail(email, token, name)
    } catch (error) {
      console.error("Failed to send verification email:", error)
      // Don't fail registration if email sending fails
      // User can request a new verification email later
    }

    return NextResponse.json({
      message: "Registration successful! Please check your email to verify your account.",
      requiresVerification: true,
      organizationEmail: `${result.organization.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`,
      organizationSlug: result.organization.slug
    })

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    )
  }
}
