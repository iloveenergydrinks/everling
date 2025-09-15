# Postmark Webhook Field Mapping

## When using Cloudflare Email Routing → Postmark

Postmark might send the original recipient in different fields:

1. **OriginalRecipient** - The original email address before forwarding
2. **ToFull** - Array with full recipient details
3. **Headers** - May contain X-Original-To or similar headers
4. **Envelope** - May contain envelope recipient

## Debug Steps

1. Check Railway logs after sending an email
2. Look for the console.log outputs we just added
3. See what fields Postmark is actually sending

## Possible Field Names for Original Recipient

According to Postmark docs, when email is forwarded:
- `OriginalRecipient` - Original recipient email
- `ToFull[0].Email` - First recipient in full format
- Headers may contain:
  - `X-Original-To`
  - `X-Forwarded-To`
  - `Delivered-To`

## Testing

Send an email to `martinofabbro@everling.io` and check Railway logs for:
```
Processing inbound email: {
  To: "...",  // This will be the Postmark address
  OriginalRecipient: "...",  // This should be martinofabbro@everling.io
  From: "...",
  Subject: "..."
}
```
