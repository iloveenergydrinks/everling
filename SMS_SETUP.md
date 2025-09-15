# SMS Reminders Setup Guide

## Quick Start (Testing Without Real SMS)

For testing without actually sending SMS messages, you can use a mock mode:

1. **Set environment variables:**
```env
# In your .env file
SMS_MODE=mock  # Set to 'mock' for testing without real SMS
```

2. **Enable SMS in the app:**
- Go to Settings in your dashboard
- Enter any phone number
- Click "Enable SMS Reminders"
- The system will simulate SMS without actually sending

## Production Setup with Twilio

### Step 1: Get a Twilio Account

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Verify your email and phone number
3. You'll get $15 free credit for testing

### Step 2: Get a Phone Number for SMS

1. Go to Phone Numbers → Manage → Buy a Number
2. Search for a number with SMS capabilities
3. Purchase the number (costs ~$1/month)
4. Copy your new phone number

### Step 3: Get Your Credentials

1. Go to Account → API keys & tokens
2. Copy your **Account SID**
3. Copy your **Auth Token**

### Step 4: Configure Environment Variables

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890  # Your purchased Twilio number

# Optional: Set SMS mode
SMS_MODE=production  # or 'mock' for testing
```

### Step 5: Set Up Webhook (for replies)

1. In Twilio Console, go to Phone Numbers → Manage → Active Numbers
2. Click on your number
3. In the Messaging section, set the webhook URL:
   ```
   https://yourdomain.com/api/webhooks/sms
   ```
4. Set the method to **HTTP POST**

## Testing Your Setup

1. Enable SMS in your app settings
2. Create a task with a reminder
3. You should receive an SMS when the reminder is due

## SMS Commands

When you receive a reminder, you can reply with:
- **DONE** - Mark task as complete
- **1H** - Snooze for 1 hour
- **TOM** - Move to tomorrow 9am
- Any other text - Added as a comment to the task

## Troubleshooting

### Error: "Mismatch between the 'From' number"
- You're using a WhatsApp-only number. Purchase a regular SMS number.

### Error: "Failed to send SMS"
- Check your Twilio credentials
- Verify the phone number format (should include country code)
- Ensure you have Twilio credit

### Not receiving messages
- Check that reminders are set and due
- Verify your phone number is correct
- Check Twilio logs for delivery status

## Cost Information

- **Twilio Phone Number**: ~$1/month
- **SMS in US/Canada**: ~$0.0075 per message
- **International SMS**: Varies by country ($0.02-0.10)
- **Free tier**: $15 credit for testing

## Security Notes

- Never commit your Twilio credentials to git
- Use environment variables for all sensitive data
- Consider using Twilio Verify for additional security
- Set up webhook signature validation in production
