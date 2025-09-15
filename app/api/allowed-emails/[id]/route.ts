import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// DELETE /api/allowed-emails/[id] - Remove an allowed email
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    // Verify the email belongs to the user's organization
    const allowedEmail = await prisma.allowedEmail.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!allowedEmail) {
      return NextResponse.json(
        { error: "Allowed email not found" },
        { status: 404 }
      )
    }

    // Don't allow removing the registration email if it's the only admin's email
    const admins = await prisma.organizationMember.findMany({
      where: {
        organizationId: session.user.organizationId,
        role: 'admin',
      },
      include: {
        user: true,
      }
    })

    const isOnlyAdminEmail = admins.length === 1 && 
                            admins[0].user.email === allowedEmail.email

    if (isOnlyAdminEmail) {
      return NextResponse.json(
        { error: "Cannot remove the only admin's email from allowed list" },
        { status: 400 }
      )
    }

    await prisma.allowedEmail.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting allowed email:", error)
    return NextResponse.json(
      { error: "Failed to delete allowed email" },
      { status: 500 }
    )
  }
}
