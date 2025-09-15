# Quick Twilio Setup for Real SMS

## Step 1: Add Your Twilio Credentials

Create or edit `.env.local` file in your project root with:

```bash
# SMS Configuration - REAL SMS MODE
SMS_MODE=production

# Your Twilio Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+12345678900  # Your Twilio SMS number

# Cron job security
CRON_SECRET=your-secret-key-here
```

## Step 2: Get Your Credentials from Twilio

1. **Account SID & Auth Token:**
   - Go to [Twilio Console](https://console.twilio.com)
   - Find them on the dashboard homepage
   - Or go to Account → API keys & tokens

2. **Phone Number:**
   - Go to Phone Numbers → Manage → Active Numbers
   - Use your purchased SMS number (NOT the WhatsApp sandbox)
   - Format: `+1234567890` (with country code)

## Step 3: Important - Get the RIGHT Phone Number

⚠️ **CRITICAL**: You need a regular SMS number, NOT the WhatsApp sandbox number!

- ❌ WRONG: `+14155238886` (WhatsApp sandbox)
- ✅ RIGHT: Your purchased SMS number from Twilio

If you don't have an SMS number yet:
1. Go to Phone Numbers → Buy a Number
2. Choose a number with SMS capability
3. Purchase it (~$1/month)

## Step 4: Restart Your App

After adding credentials:

```bash
# Kill the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 5: Test It!

1. Go to Settings in dashboard
2. Enable SMS Reminders
3. Click "Send Test SMS"
4. You should receive a real SMS!

## Troubleshooting

### "Mismatch between the 'From' number" Error
- You're using the WhatsApp number instead of an SMS number
- Solution: Buy a regular SMS number from Twilio

### Not receiving SMS?
- Check Twilio dashboard for message logs
- Verify phone number format includes country code
- Ensure you have Twilio credit/balance

### Still want to test without sending?
Change `SMS_MODE=mock` to test without real SMS

## Cost Info
- SMS to US/Canada: ~$0.0075 per message
- International: $0.02-0.10 per message
- Phone number: ~$1/month

## Setting Up Incoming SMS (Optional)

To handle SMS replies:
1. In Twilio Console, go to your phone number settings
2. Set webhook URL to: `https://yourdomain.com/api/webhooks/sms`
3. Method: POST

This allows users to reply with:
- DONE - Complete task
- 1H - Snooze 1 hour  
- TOM - Tomorrow 9am
