# Securing Postmark Inbound Webhooks

## The Issue
Postmark doesn't provide webhook secrets for inbound email webhooks (unlike many other services). This is a known limitation.

## The Solution: Basic Authentication

### Step 1: Generate a secure token
```bash
# Generate a random secure token
openssl rand -hex 32
# Example output: webhook:a7b9c3d8e4f5g6h7i8j9k0l1m2n3o4p5
```

### Step 2: Add to Railway Environment Variables
```
POSTMARK_WEBHOOK_AUTH=webhook:your-generated-token-here
```

### Step 3: Configure Postmark Webhook URL
In Postmark, set your webhook URL with Basic Auth:
```
https://webhook:your-generated-token-here@everling.io/api/webhooks/email
```

**Format:** `https://username:password@yourdomain.com/path`

## How It Works
1. Postmark sends the webhook with Basic Auth credentials in the URL
2. Your app receives the Authorization header
3. The app verifies the credentials match `POSTMARK_WEBHOOK_AUTH`
4. Only authenticated requests are processed

## Example Setup

1. Generate token:
```bash
openssl rand -hex 32
# Output: 8f7a3b9c4d5e6f7g8h9i0j1k2l3m4n5o
```

2. Set in Railway:
```
POSTMARK_WEBHOOK_AUTH=webhook:8f7a3b9c4d5e6f7g8h9i0j1k2l3m4n5o
```

3. Set in Postmark:
```
https://webhook:8f7a3b9c4d5e6f7g8h9i0j1k2l3m4n5o@everling.io/api/webhooks/email
```

## Security Benefits
- ✅ Only requests with correct credentials are accepted
- ✅ Credentials are transmitted over HTTPS (encrypted)
- ✅ Uses timing-safe comparison to prevent timing attacks
- ✅ Works with Postmark's current limitations

## Alternative: IP Whitelisting
You could also restrict access to Postmark's IP addresses, but Basic Auth is simpler and more flexible.

## Testing
Without auth (will be rejected in production):
```
curl -X POST https://everling.io/api/webhooks/email
```

With auth (will be accepted):
```
curl -X POST https://webhook:your-token@everling.io/api/webhooks/email
```
