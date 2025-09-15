import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { taskLimit } = body

    if (typeof taskLimit !== 'number' || taskLimit < 0) {
      return NextResponse.json(
        { error: "Invalid task limit" },
        { status: 400 }
      )
    }

    // Update organization task limit
    const org = await prisma.organization.update({
      where: { id: params.id },
      data: { taskLimit }
    })

    return NextResponse.json({ 
      success: true,
      organization: org
    })
  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Delete organization and all associated data (cascades through relations)
    await prisma.organization.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting organization:", error)
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    )
  }
}
