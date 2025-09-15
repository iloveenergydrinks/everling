import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get ALL organizations globally
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            members: true,
            tasks: true,
            emailLogs: true,
            allowedEmails: true
          }
        },
        members: {
          select: {
            user: {
              select: {
                email: true,
                name: true
              }
            },
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform to include member details
    const transformedOrgs = organizations.map(org => ({
      ...org,
      adminEmails: org.members
        .filter(m => m.role === 'admin')
        .map(m => m.user.email)
    }))

    return NextResponse.json(transformedOrgs)
  } catch (error) {
    console.error("Error fetching organizations:", error)
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    )
  }
}
