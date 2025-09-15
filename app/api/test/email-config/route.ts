import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check email configuration
  const config = {
    emailDomain: process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'not set',
    hasPostmarkToken: !!process.env.POSTMARK_SERVER_TOKEN,
    hasPostmarkWebhookAuth: !!process.env.POSTMARK_WEBHOOK_AUTH,
    hasPostmarkWebhookSecret: !!process.env.POSTMARK_WEBHOOK_SECRET,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    nextAuthUrl: process.env.NEXTAUTH_URL || 'not set',
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'not configured',
  }

  return NextResponse.json({
    status: "Email configuration check",
    config,
    timestamp: new Date().toISOString(),
    instructions: {
      postmark: "Ensure Postmark is configured to send emails to your webhook URL",
      webhook: `https://everling.io/api/webhooks/email`,
      required_env_vars: [
        "NEXT_PUBLIC_EMAIL_DOMAIN - Domain for your email addresses",
        "POSTMARK_SERVER_TOKEN - For sending emails (optional)",
        "ANTHROPIC_API_KEY - For AI email processing",
        "DATABASE_URL - PostgreSQL connection string"
      ]
    }
  })
}
