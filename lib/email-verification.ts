import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { ServerClient } from 'postmark'

const postmark = process.env.POSTMARK_SERVER_TOKEN 
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null

export async function createVerificationToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires
    }
  })

  return token
}

export async function verifyToken(token: string): Promise<{ email: string } | null> {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      token
    }
  })

  if (!verificationToken) {
    return null
  }

  if (verificationToken.expires < new Date()) {
    // Token expired
    await prisma.verificationToken.delete({
      where: { token }
    })
    return null
  }

  // Delete the token after successful verification
  await prisma.verificationToken.delete({
    where: { token }
  })

  return { email: verificationToken.identifier }
}

export async function sendVerificationEmail(email: string, token: string, name?: string) {
  const verificationUrl = `${process.env.NEXTAUTH_URL || 'https://everling.io'}/api/auth/verify-email?token=${token}`

  if (!postmark) {
    console.log('[MOCK EMAIL] Verification link:', verificationUrl)
    return
  }

  try {
    await postmark.sendEmail({
      From: 'noreply@everling.io',
      To: email,
      Subject: 'Verify your Everling.io account',
      HtmlBody: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 20px;">Welcome to Everling.io${name ? `, ${name}` : ''}!</h1>
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
            Please verify your email address to complete your registration and start using Everling.io.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="display: inline-block; padding: 12px 24px; background: #000; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Or copy and paste this link: ${verificationUrl}
          </p>
        </div>
      `,
      TextBody: `Welcome to Everling.io${name ? `, ${name}` : ''}!

Please verify your email address by clicking this link:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.`,
      MessageStream: 'outbound'
    })
  } catch (error) {
    console.error('Failed to send verification email:', error)
    throw error
  }
}
