import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateToken, sendPasswordResetEmail } from "@/lib/password-reset"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
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

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ 
        success: true,
        message: "If an account exists, a password reset link has been sent"
      })
    }

    // Check if there's a recent token (prevent spam)
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes
        }
      }
    })

    if (recentToken) {
      return NextResponse.json({ 
        success: true,
        message: "A password reset link was recently sent. Please check your email."
      })
    }

    // Delete any old tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email }
    })

    // Generate new token and send email
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
      message: "If an account exists, a password reset link has been sent"
    })
  } catch (error) {
    console.error("Error handling forgot password:", error)
    // Still return success to prevent enumeration
    return NextResponse.json({ 
      success: true,
      message: "If an account exists, a password reset link has been sent"
    })
  }
}