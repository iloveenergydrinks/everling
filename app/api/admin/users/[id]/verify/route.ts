import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function POST(
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

    // Manually verify the user's email
    const user = await prisma.user.update({
      where: { id: params.id },
      data: { 
        emailVerified: new Date() 
      }
    })

    return NextResponse.json({ 
      success: true,
      message: `Email verified for ${user.email}`
    })
  } catch (error) {
    console.error("Error verifying user email:", error)
    return NextResponse.json(
      { error: "Failed to verify user email" },
      { status: 500 }
    )
  }
}
