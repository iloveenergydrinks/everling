import { NextRequest, NextResponse } from "next/server"

// Test endpoint to simulate Postmark webhook
// GET /api/webhooks/test-email
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const to = searchParams.get("to") || "martino@everling.io"
  const subject = searchParams.get("subject") || "Test Task: Review Q4 budget proposal"
  const from = searchParams.get("from") || "john@example.com"
  
  // Simulate Postmark webhook payload
  const testPayload = {
    From: from,
    To: to,
    Subject: subject,
    TextBody: `Hi team,

Please review the Q4 budget proposal by end of this week. This is urgent as we need to submit it to the board by Monday.

Key points to review:
- Marketing spend allocation
- Engineering headcount increase
- Infrastructure costs

Let me know if you have any questions.

Best,
John`,
    HtmlBody: undefined,
    Date: new Date().toISOString(),
    MessageID: `test-${Date.now()}@example.com`
  }

  try {
    // Call the actual webhook endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/webhooks/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    })

    const result = await response.json()

    return NextResponse.json({
      message: "Test email sent to webhook",
      payload: testPayload,
      webhookResponse: result,
      success: response.ok
    })
  } catch (error) {
    return NextResponse.json({
      error: "Failed to send test email",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Simple UI for testing
export async function POST(request: NextRequest) {
  const body = await request.json()
  
  // Call the actual webhook endpoint
  const response = await fetch(`${request.nextUrl.origin}/api/webhooks/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const result = await response.json()
  
  return NextResponse.json(result, { status: response.status })
}
