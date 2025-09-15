import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/allowed-emails - List allowed emails for the organization
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const allowedEmails = await prisma.allowedEmail.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        addedBy: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(allowedEmails)
  } catch (error) {
    console.error("Error fetching allowed emails:", error)
    return NextResponse.json(
      { error: "Failed to fetch allowed emails" },
      { status: 500 }
    )
  }
}

// POST /api/allowed-emails - Add a new allowed email
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
      }
    }
  })

  if (!member || member.role !== 'admin') {
    return NextResponse.json(
      { error: "Only admins can manage allowed emails" },
      { status: 403 }
    )
  }

  try {
    const { email, note } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
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

    // Check if email already exists
    const existing = await prisma.allowedEmail.findUnique({
      where: {
        organizationId_email: {
          organizationId: session.user.organizationId,
          email: email.toLowerCase(),
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Email already in allowed list" },
        { status: 400 }
      )
    }

    const allowedEmail = await prisma.allowedEmail.create({
      data: {
        organizationId: session.user.organizationId,
        email: email.toLowerCase(),
        addedById: session.user.id,
        note,
      },
      include: {
        addedBy: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    })

    return NextResponse.json(allowedEmail)
  } catch (error) {
    console.error("Error adding allowed email:", error)
    return NextResponse.json(
      { error: "Failed to add allowed email" },
      { status: 500 }
    )
  }
}
