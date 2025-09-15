import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

// Verify webhook is from Twilio (optional but recommended for security)
function verifyTwilioWebhook(request: NextRequest): boolean {
  // In production, verify the webhook signature
  // For now, we'll skip verification for simplicity
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Parse the form data from Twilio
    const formData = await request.formData()
    
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const to = formData.get('To') as string
    
    if (!from || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    console.log('SMS webhook received:', { from, body, to })
    
    // Check if it's a digest reply (single number)
    const isDigestReply = /^\d$/.test(body.trim())
    
    let result
    if (isDigestReply) {
      // Handle daily digest reply
      const { handleDigestReply } = await import('@/lib/daily-digest')
      result = await handleDigestReply(from, body)
    } else {
      // Handle regular SMS reply
      const { handleSMSReply } = await import('@/lib/sms')
      result = await handleSMSReply(from, body)
    }
    
    // Send reply back via SMS if there's a reply message
    if (result.reply && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
      
      await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER || to, // Use configured number or the one that received
        to: from, // Reply to sender
        body: result.reply
      })
    }
    
    // Return TwiML response (Twilio expects this format)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${result.reply || 'Message received'}</Message>
</Response>`
    
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })
    
  } catch (error) {
    console.error('SMS webhook error:', error)
    
    // Return empty TwiML response on error
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`
    
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    })
  }
}

// Endpoint to verify SMS webhook is working
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'SMS webhook endpoint is active',
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com'}/api/webhooks/sms`
  })
}
