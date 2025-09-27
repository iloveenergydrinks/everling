# Postmark Inbound Email Setup for Everling.io

## Your Webhook URL
```
https://everling.io/api/webhooks/email
```

## Step 1: Configure Postmark Inbound

1. Log into Postmark
2. Go to your Server (or create one)
3. Click on **Inbound** in the left menu
4. Click **Add Domain**
5. Enter: `everling.io`
6. Set the webhook URL: `https://everling.io/api/webhooks/email`

## Step 2: Add MX Records to Your DNS

Postmark will show you MX records. Add them to your DNS provider:

**Standard MX Record:**
```
Type: MX
Host: @ (or leave blank for root domain)
Priority: 10
Value: inbound.postmarkapp.com
```

If you want to use a subdomain like `mail.everling.io`:
```
Type: MX
Host: mail
Priority: 10
Value: inbound.postmarkapp.com
```

## Step 3: Test Your Setup

Once DNS propagates (5-30 minutes):

1. Send an email to: `martinofabbro@everling.io`
2. Check your Everling dashboard - it should create a task
3. Check Postmark's "Inbound" activity to see if the email was received

## How It Works

1. Someone sends email to `martinofabbro@everling.io`
2. Your MX records direct it to Postmark
3. Postmark receives the email
4. Postmark sends the email data to your webhook: `https://everling.io/api/webhooks/email`
5. Your app creates a task from the email

## Troubleshooting

- **Email not received?** Check MX records are correct
- **Webhook not triggered?** Check the URL is exactly: `https://everling.io/api/webhooks/email`
- **Task not created?** Check Railway logs for errors
- **403 Forbidden?** Make sure the sender is in your allowed emails list

## Environment Variables Needed

Make sure these are set in Railway:
```
POSTMARK_SERVER_TOKEN=your-server-token
```

## Testing with Postmark's Test Feature

Postmark has a test feature:
1. Go to Inbound → Your Domain
2. Click "Test" 
3. It will send a test email to your webhook
4. Check your Railway logs to see if it's received
