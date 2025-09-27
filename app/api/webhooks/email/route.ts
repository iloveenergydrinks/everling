import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@/lib/email"
import { enqueueInboundEmail } from "@/lib/queues/email-queue"
import { logTrace, logGlobal } from "@/lib/redis-logs"
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

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
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
    
    // First check if lengths match (required for timingSafeEqual)
    const authBuffer = Buffer.from(authHeader)
    const expectedBuffer = Buffer.from(expectedAuth)
    
    if (authBuffer.length !== expectedBuffer.length) {
      return false
    }
    
    return crypto.timingSafeEqual(authBuffer, expectedBuffer)
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
    // Generate a trace id for this request
    const requestId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    console.log('traceId:', requestId)
    // Skip auth check only in development for easier testing
    const skipAuth = process.env.NODE_ENV !== 'production'
    
    // Verify authentication (always required in production)
    if (!skipAuth && !verifyPostmarkAuth(request)) {
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
    ;(emailData as any)._traceId = requestId
    await logTrace(requestId, 'webhook:received', { keys: Object.keys(emailData || {}) })
    await logGlobal('webhook:received', requestId, { from: emailData.From, subject: emailData.Subject })
    console.log('Parsed email data keys:', Object.keys(emailData))
    
    // Debug: Log all recipient-related fields
    console.log('📧 Webhook recipient fields:', {
      To: emailData.To,
      ToFull: emailData.ToFull,
      OriginalRecipient: emailData.OriginalRecipient,
      Cc: emailData.Cc,
      Bcc: emailData.Bcc,
      Headers: emailData.Headers?.filter((h: any) => 
        ['to', 'x-original-to', 'delivered-to', 'envelope-to'].includes(h.Name.toLowerCase())
      )
    })

    // Validate required fields
    if (!emailData.From || !emailData.To || !emailData.Subject) {
      return NextResponse.json(
        { error: "Invalid email data" },
        { status: 400 }
      )
    }

    // Enqueue processing and return immediately
    try {
      await enqueueInboundEmail({ emailData, requestId })
      console.log(`[${requestId}] Enqueued inbound email`)
      await logTrace(requestId, 'queue:enqueued')
      await logGlobal('queue:enqueued', requestId, { messageId: emailData.MessageID })
    } catch (e) {
      console.error(`[${requestId}] Failed to enqueue inbound email, falling back to inline processing`, e)
      await logTrace(requestId, 'queue:enqueue_failed', { error: (e as any)?.message })
      // Fallback inline (best effort) to avoid data loss
      processInboundEmail(emailData)
        .then(() => logTrace(requestId, 'inline:processed'))
        .catch(err => {
          console.error(`[${requestId}] Inline processing error:`, err)
          logTrace(requestId, 'inline:error', { error: (err as any)?.message })
        })
    }

    return NextResponse.json({ success: true, queued: true, traceId: requestId }, { status: 200 })

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
