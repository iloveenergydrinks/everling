import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// One-time fix to add user's email to allowed list
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email || !session?.user?.organizationId) {
      return NextResponse.json({
        error: "No session or missing data",
        session: !!session,
        hasEmail: !!session?.user?.email,
        hasOrgId: !!session?.user?.organizationId
      }, { status: 401 })
    }

    // Check if email already exists
    const existing = await prisma.allowedEmail.findUnique({
      where: {
        organizationId_email: {
          organizationId: session.user.organizationId,
          email: session.user.email.toLowerCase()
        }
      }
    })

    if (existing) {
      return NextResponse.json({
        message: "Email already in allowed list",
        email: existing.email
      })
    }

    // Add the user's email to allowed list
    const allowedEmail = await prisma.allowedEmail.create({
      data: {
        organizationId: session.user.organizationId,
        email: session.user.email.toLowerCase(),
        addedById: session.user.id,
        note: "Registration email (auto-added via fix)"
      }
    })

    // Also check and add any other org members' emails
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: session.user.organizationId },
      include: { user: true }
    })

    const addedEmails = [allowedEmail.email]
    
    for (const member of members) {
      if (member.user.email && member.user.email !== session.user.email) {
        const exists = await prisma.allowedEmail.findUnique({
          where: {
            organizationId_email: {
              organizationId: session.user.organizationId,
              email: member.user.email.toLowerCase()
            }
          }
        })
        
        if (!exists) {
          await prisma.allowedEmail.create({
            data: {
              organizationId: session.user.organizationId,
              email: member.user.email.toLowerCase(),
              addedById: session.user.id,
              note: "Organization member email (auto-added)"
            }
          })
          addedEmails.push(member.user.email)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Emails added to allowed list",
      addedEmails,
      totalAllowed: await prisma.allowedEmail.count({
        where: { organizationId: session.user.organizationId }
      })
    })
  } catch (error: any) {
    console.error("Error adding allowed email:", error)
    return NextResponse.json({
      error: "Failed to add email",
      details: error.message
    }, { status: 500 })
  }
}
