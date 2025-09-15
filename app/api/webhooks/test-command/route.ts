import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@/lib/email"

// Test endpoint for command processing
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const { command, forwardedEmail, to = 'martino@everling.io' } = await request.json()
    
    // Build email body with command and forwarded content
    let emailBody = command || ''
    
    if (forwardedEmail) {
      emailBody += `\n\n---------- Forwarded message ----------\n`
      emailBody += `From: ${forwardedEmail.from || 'client@example.com'}\n`
      emailBody += `Subject: ${forwardedEmail.subject || 'Original Subject'}\n`
      emailBody += `Date: ${forwardedEmail.date || new Date().toISOString()}\n\n`
      emailBody += forwardedEmail.body || 'Original email content here...'
    }
    
    // Simulate a Postmark payload with command
    const emailData = {
      From: 'olmo93@hotmail.it', // Your registered email
      To: to,
      Subject: forwardedEmail?.subject || command || 'Test Command',
      TextBody: emailBody,
      HtmlBody: undefined,
      Date: new Date().toISOString(),
      MessageID: `test-command-${Date.now()}@example.com`,
      Headers: []
    }

    // Process the email
    const result = await processInboundEmail(emailData)
    
    return NextResponse.json({ 
      success: true, 
      result,
      processedData: {
        command: command,
        hasForward: !!forwardedEmail,
        body: emailBody.substring(0, 200) + '...'
      }
    })
  } catch (error) {
    console.error("Test command error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process test command'
    }, { status: 500 })
  }
}

// Examples to test:
// 
// 1. Simple reminder:
// {
//   "command": "Remind me about this in 3 days",
//   "forwardedEmail": {
//     "from": "client@example.com",
//     "subject": "Contract renewal",
//     "body": "Your contract is expiring next month..."
//   }
// }
//
// 2. Priority and due date:
// {
//   "command": "Urgent - needs to be done by Friday",
//   "forwardedEmail": {
//     "from": "boss@company.com",
//     "subject": "Budget report",
//     "body": "Please review the attached budget..."
//   }
// }
//
// 3. Direct command:
// {
//   "command": "Tomorrow at 2pm: Call John about the project"
// }
//
// 4. Status update in thread:
// {
//   "command": "This is done, closing the task"
// }
