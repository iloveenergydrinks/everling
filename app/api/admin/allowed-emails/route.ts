import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Admin-only endpoint to get all allowed emails across all organizations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    const ADMIN_EMAILS = [
      "martino.fabbro@gmail.com",
      "olmo93@hotmail.it",
    ]
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json({ error: "Unauthorized - admin only" }, { status: 403 })
    }
    
    // Get all allowed emails across all organizations
    const allowedEmails = await prisma.allowedEmail.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        addedBy: {
          select: {
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return NextResponse.json(allowedEmails)
    
  } catch (error) {
    console.error("Admin allowed emails error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
