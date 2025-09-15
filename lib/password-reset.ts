import crypto from 'crypto'
import { ServerClient } from 'postmark'
import { prisma } from './prisma'

const postmark = process.env.POSTMARK_SERVER_TOKEN 
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null

export async function generateToken(): Promise<string> {
  return crypto.randomBytes(32).toString('hex')
}

export async function sendPasswordResetEmail(
  email: string, 
  token: string,
  name?: string | null
) {
  // Always use production URL for email links, regardless of NEXTAUTH_URL
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://everling.io' 
    : (process.env.NEXTAUTH_URL || 'http://localhost:3000')
  
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  
  if (!postmark) {
    console.log('[MOCK EMAIL] Password reset link:', resetUrl)
    return
  }

  try {
    await postmark.sendEmail({
      From: process.env.EMAIL_FROM || 'noreply@everling.io',
      To: email,
      Subject: 'Reset your password',
      HtmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">Reset your password</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Hi ${name || 'there'},
          </p>
          
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 500;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            Or copy and paste this link into your browser:
          </p>
          
          <p style="color: #666; line-height: 1.6; word-break: break-all;">
            ${resetUrl}
          </p>
          
          <p style="color: #999; font-size: 14px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Everling.io. All rights reserved.
          </p>
        </div>
      `,
      TextBody: `
Reset your password

Hi ${name || 'there'},

We received a request to reset your password. Visit the following link to set a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Everling.io. All rights reserved.
      `
    })
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw error
  }
}

export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token }
    })

    if (!resetToken) {
      return null
    }

    // Check if token has expired
    if (resetToken.expires < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { token }
      })
      return null
    }

    return resetToken.email
  } catch (error) {
    console.error('Error verifying reset token:', error)
    return null
  }
}

export async function deleteResetToken(token: string) {
  try {
    await prisma.passwordResetToken.delete({
      where: { token }
    })
  } catch (error) {
    console.error('Error deleting reset token:', error)
  }
}
