import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@/lib/email"
import crypto from "crypto"

export const dynamic = 'force-dynamic'

// Handle GET requests with a helpful message
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "This is a webhook endpoint for Postmark inbound emails",
    status: "healthy",
    method: "Please use POST to send email data",
    timestamp: new Date().toISOString(),
    instructions: "Configure your Postmark inbound webhook to POST to this URL"
  }, { status: 200 })
}

// Verify Postmark webhook signature
// Postmark doesn't provide webhook secrets for inbound emails
// Instead, we use Basic Auth in the webhook URL
function verifyPostmarkAuth(request: NextRequest): boolean {
  // Get the Authorization header
  const authHeader = request.headers.get('authorization')
  
  // If we have a webhook auth token configured, verify it
  if (process.env.POSTMARK_WEBHOOK_AUTH) {
    if (!authHeader) {
      console.warn('Missing authorization header')
      return false
    }
    
    // Basic auth format: "Basic base64(username:password)"
    const expectedAuth = `Basic ${Buffer.from(process.env.POSTMARK_WEBHOOK_AUTH).toString('base64')}`
    
    return crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expectedAuth)
    )
  }
  
  // No auth configured - accept in development but warn
  if (process.env.NODE_ENV === 'production') {
    console.warn('POSTMARK_WEBHOOK_AUTH not configured - webhook is not secure!')
  }
  return true
}

export async function POST(request: NextRequest) {
  console.log('Email webhook received')
  
  try {
    // Verify authentication
    if (!verifyPostmarkAuth(request)) {
      console.error('Webhook authentication failed')
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    
    console.log('Webhook authentication passed')
    
    // Get raw body
    const body = await request.text()
    console.log('Raw webhook body length:', body.length)

    // Parse verified webhook data
    const emailData = JSON.parse(body)
    console.log('Parsed email data keys:', Object.keys(emailData))

    // Validate required fields
    if (!emailData.From || !emailData.To || !emailData.Subject) {
      return NextResponse.json(
        { error: "Invalid email data" },
        { status: 400 }
      )
    }

    // Queue processing and return immediately
    setTimeout(() => {
      processInboundEmail(emailData)
        .then((res) => {
          if (res && typeof res === 'object' && 'status' in res && (res as any).status === 'rejected') {
            const r: any = res
            console.log(`Async email rejected: ${r.reason} - ${r.message}`)
          } else if (res && typeof res === 'object' && 'id' in res) {
            console.log(`Async email processed: taskId=${(res as any).id}`)
          } else if (res && typeof res === 'object' && 'taskId' in res) {
            const r: any = res
            console.log(`Async email processed: taskId=${r.taskId}`)
          } else {
            console.log('Async email processed (no task)')
          }
        })
        .catch((err) => {
          console.error('Async email processing error:', err)
        })
    }, 0)

    return NextResponse.json({ success: true, queued: true }, { status: 200 })

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
