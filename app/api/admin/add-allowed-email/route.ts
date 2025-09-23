import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Only admins can add allowed emails via API
    if (!session?.user?.organizationRole || session.user.organizationRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized - admin only" }, { status: 403 })
    }
    
    const body = await request.json()
    const { email, organizationId, note } = body
    
    if (!email || !organizationId) {
      return NextResponse.json({ error: "Email and organizationId are required" }, { status: 400 })
    }
    
    // Verify the organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        allowedEmails: true
      }
    })
    
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }
    
    // Check if email is already allowed
    const alreadyAllowed = organization.allowedEmails.some(e => e.email === email)
    if (alreadyAllowed) {
      return NextResponse.json({ 
        message: "Email is already in the allowed list",
        email 
      }, { status: 200 })
    }
    
    // Find the user (if they exist)
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    // Add to allowed emails
    const allowedEmail = await prisma.allowedEmail.create({
      data: {
        organizationId,
        email,
        addedById: session.user.id,
        note: note || (user ? `${user.name || 'Organization member'}` : 'Added via admin API')
      }
    })
    
    return NextResponse.json({
      success: true,
      message: `Successfully added ${email} to allowed emails`,
      allowedEmail
    })
    
  } catch (error) {
    console.error("Add allowed email error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Helper endpoint to find organization by email prefix
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.organizationRole || session.user.organizationRole !== 'admin') {
      return NextResponse.json({ error: "Unauthorized - admin only" }, { status: 403 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const emailPrefix = searchParams.get('emailPrefix')
    const userEmail = searchParams.get('userEmail')
    
    let result: any = {}
    
    if (emailPrefix) {
      const organization = await prisma.organization.findUnique({
        where: { emailPrefix },
        include: {
          members: {
            include: {
              user: true
            }
          },
          allowedEmails: true
        }
      })
      
      if (organization) {
        result.organization = {
          id: organization.id,
          name: organization.name,
          emailPrefix: organization.emailPrefix,
          members: organization.members.map(m => ({
            email: m.user.email,
            name: m.user.name,
            role: m.role
          })),
          allowedEmails: organization.allowedEmails.map(e => ({
            email: e.email,
            note: e.note
          }))
        }
      }
    }
    
    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: {
          organizations: {
            include: {
              organization: true
            }
          }
        }
      })
      
      if (user) {
        result.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          organizations: user.organizations.map(o => ({
            id: o.organization.id,
            name: o.organization.name,
            emailPrefix: o.organization.emailPrefix,
            role: o.role
          }))
        }
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error("Lookup error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
