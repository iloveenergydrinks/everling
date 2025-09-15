import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { verifyResetToken, deleteResetToken } from "@/lib/password-reset"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      )
    }

    // Verify the token and get the email
    const email = await verifyResetToken(token)
    
    if (!email) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await hash(password, 12)

    // Update the user's password
    await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        // Also verify their email if it wasn't already
        emailVerified: new Date()
      }
    })

    // Delete the used token
    await deleteResetToken(token)

    return NextResponse.json({ 
      success: true,
      message: "Password updated successfully",
      email
    })
  } catch (error) {
    console.error("Error resetting password:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}