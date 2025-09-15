import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@/lib/email"
import crypto from "crypto"

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

    // Process the email asynchronously
    // In production, you might want to use a queue here
    const result = await processInboundEmail(emailData)

    // Handle different return types from processInboundEmail
    if (result && typeof result === 'object') {
      // Check if email was rejected (not an error, just not processed)
      if ('status' in result && (result as any).status === 'rejected') {
        const rejectedResult = result as any
        console.log(`Email rejected: ${rejectedResult.reason} - ${rejectedResult.message}`)
        return NextResponse.json({
          success: false,
          status: 'rejected',
          reason: rejectedResult.reason,
          message: rejectedResult.message
        }, { status: 200 }) // Return 200 OK even for rejected emails (not an error)
      }
      
      // If it's a task object (has id property)
      if ('id' in result) {
        return NextResponse.json({
          success: true,
          taskId: result.id
        })
      }
      
      // If it's a status object (has taskId property)
      if ('taskId' in result) {
        return NextResponse.json({
          success: true,
          taskId: result.taskId,
          message: result.message || 'Email processed',
          isReply: result.isReply || false
        })
      }
    }

    // Fallback
    return NextResponse.json({
      success: true,
      taskId: null,
      message: 'Email processed'
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
