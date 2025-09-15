import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"

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

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
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
          note: 'Registration email (auto-added)',
        }
      })

      return { user, organization }
    })

    return NextResponse.json({
      message: "Registration successful",
      organizationEmail: `${result.organization.emailPrefix}@${process.env.EMAIL_DOMAIN}`,
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
