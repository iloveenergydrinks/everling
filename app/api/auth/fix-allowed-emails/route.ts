import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// One-time fix to ensure all organization members have their emails in allowed list
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get the user's organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        members: {
          include: {
            user: true
          }
        },
        allowedEmails: true
      }
    })
    
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }
    
    const addedEmails: string[] = []
    const skippedEmails: string[] = []
    
    // Check each member's email
    for (const member of organization.members) {
      const memberEmail = member.user.email.toLowerCase()
      
      // Check if email is already in allowed list
      const alreadyAllowed = organization.allowedEmails.some(
        ae => ae.email.toLowerCase() === memberEmail
      )
      
      if (!alreadyAllowed) {
        try {
          await prisma.allowedEmail.create({
            data: {
              organizationId: organization.id,
              email: memberEmail,
              addedById: session.user.id,
              note: `Organization member`
            }
          })
          addedEmails.push(memberEmail)
        } catch (error) {
          console.error(`Failed to add ${memberEmail}:`, error)
          skippedEmails.push(memberEmail)
        }
      } else {
        skippedEmails.push(memberEmail)
      }
    }
    
    return NextResponse.json({
      message: "Email fix completed",
      addedEmails,
      skippedEmails,
      totalMembers: organization.members.length
    })
    
  } catch (error) {
    console.error("Fix allowed emails error:", error)
    return NextResponse.json({ 
      error: "Failed to fix allowed emails",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
