import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@/lib/email"
import crypto from "crypto"

// Verify Postmark webhook signature
function verifyPostmarkWebhook(body: string, signature: string | null): boolean {
  if (!signature || !process.env.POSTMARK_WEBHOOK_SECRET) {
    console.warn("Missing webhook signature or secret")
    return false
  }

  const computedSignature = crypto
    .createHmac('sha256', process.env.POSTMARK_WEBHOOK_SECRET)
    .update(body)
    .digest('base64')

  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text()
    const signature = request.headers.get('X-Postmark-Signature')

    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      if (!verifyPostmarkWebhook(body, signature)) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }
    }

    // Parse verified webhook data
    const emailData = JSON.parse(body)

    // Validate required fields
    if (!emailData.From || !emailData.To || !emailData.Subject) {
      return NextResponse.json(
        { error: "Invalid email data" },
        { status: 400 }
      )
    }

    // Process the email asynchronously
    // In production, you might want to use a queue here
    const result = await processInboundEmail(emailData)

    return NextResponse.json({
      success: true,
      taskId: result.taskId || null,
      message: result.message || 'Email processed',
      isReply: result.isReply || false
    })

  } catch (error) {
    console.error("Email webhook error:", error)
    
    // Return success to Postmark even on error to avoid retries
    // The error is logged in the EmailLog table
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    })
  }
}

// Handle Postmark webhook verification
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}
