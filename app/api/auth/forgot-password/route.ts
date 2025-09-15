import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { ServerClient } from 'postmark'

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN || '')

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        organizations: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: "If an account exists, you'll receive a reset link"
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date()
    expires.setHours(expires.getHours() + 1) // 1 hour expiration

    // Store reset token
    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: resetToken,
        expires: expires
      }
    })

    // Get organization for branded email
    const organization = user.organizations[0]?.organization
    const fromEmail = organization ? 
      `${organization.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}` :
      process.env.EMAIL_FROM || 'noreply@everling.io'

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

    try {
      if (!process.env.POSTMARK_SERVER_TOKEN) {
        console.log('[MOCK EMAIL] Would send password reset to:', email)
        console.log('[MOCK EMAIL] Reset URL:', resetUrl)
        return NextResponse.json({
          success: true,
          message: "Reset link sent (mock mode - check console)"
        })
      }

      await postmarkClient.sendEmail({
        From: fromEmail,
        To: email,
        Subject: 'Reset your Everling.io password',
        HtmlBody: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">Reset your password</h1>
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              You requested to reset your password for your Everling.io account. Click the button below to set a new password.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Reset Password
              </a>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request this reset, you can safely ignore this email.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 10px;">
              If the button doesn't work, copy and paste this link: ${resetUrl}
            </p>
          </div>
        `,
        TextBody: `Reset your Everling.io password\n\nClick this link to set a new password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this reset, you can safely ignore this email.`,
        MessageStream: 'outbound'
      })

      return NextResponse.json({
        success: true,
        message: "Password reset link sent to your email"
      })

    } catch (emailError) {
      console.error('Failed to send reset email:', emailError)
      return NextResponse.json(
        { error: "Failed to send reset email" },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
