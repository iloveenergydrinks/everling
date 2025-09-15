import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateToken, sendPasswordResetEmail } from "@/lib/password-reset"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Generate reset token and send email
    const token = await generateToken()
    
    // Store token in database with expiry (1 hour)
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires: new Date(Date.now() + 3600000) // 1 hour
      }
    })

    // Send the reset email
    await sendPasswordResetEmail(email, token, user.name)

    return NextResponse.json({ 
      success: true,
      message: `Password reset link sent to ${email}`
    })
  } catch (error) {
    console.error("Error sending password reset:", error)
    return NextResponse.json(
      { error: "Failed to send password reset" },
      { status: 500 }
    )
  }
}
