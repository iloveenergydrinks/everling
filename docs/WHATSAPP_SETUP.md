# WhatsApp Reminders Setup Guide

## Overview
The system now supports WhatsApp reminders for tasks, providing instant notifications with 98% open rates. Users can enable WhatsApp reminders from their dashboard settings and interact with tasks directly through WhatsApp.

## Features
- ⏰ Automatic task reminders sent to WhatsApp
- 💬 Reply to complete, snooze, or comment on tasks
- 🔐 Secure phone number verification
- 🎯 Smart reminder timing based on task priority
- ✅ One-tap actions with quick replies

## Setup Instructions

### 1. Twilio Account Setup

1. Sign up for a Twilio account at [twilio.com](https://www.twilio.com)
2. Get your credentials from the Twilio Console:
   - Account SID
   - Auth Token
   - WhatsApp Sandbox Number (for testing)

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Twilio sandbox number

# Optional: Cron job security
CRON_SECRET=your_secret_key
```

### 3. WhatsApp Sandbox Setup (Development)

1. Go to Twilio Console > Messaging > Try it out > Send a WhatsApp message
2. Follow instructions to join the sandbox (send a message like "join <sandbox-name>")
3. Your number is now connected to the sandbox for testing

### 4. Production Setup (Optional)

For production, you'll need:
1. WhatsApp Business Account
2. Facebook Business Manager
3. Approved WhatsApp Business API number
4. Update `TWILIO_WHATSAPP_NUMBER` with your business number

### 5. Configure Webhook

Set up the WhatsApp webhook URL in Twilio:
1. Go to Twilio Console > Messaging > Services
2. Set webhook URL to: `https://yourdomain.com/api/webhooks/whatsapp`
3. Method: POST
4. Configure for incoming messages

### 6. Set Up Cron Job

For automatic reminder sending, set up a cron job that calls:
```
GET https://yourdomain.com/api/cron/reminders
```

Options:
- **Vercel Cron**: Add to `vercel.json`:
  ```json
  {
    "crons": [{
      "path": "/api/cron/reminders",
      "schedule": "*/5 * * * *"
    }]
  }
  ```

- **External Service**: Use services like Uptime Robot, Cron-job.org, or GitHub Actions

- **Manual Testing**: POST to `/api/cron/reminders` while logged in

## User Guide

### Enabling WhatsApp Reminders

1. Open Dashboard → Settings
2. Find "WhatsApp Reminders" section
3. Enter phone number with country code (e.g., +1234567890)
4. Click "Enable WhatsApp Reminders"
5. Check WhatsApp for verification message
6. You're ready to receive reminders!

### WhatsApp Commands

When you receive a reminder, reply with:
- **done** - Mark task as complete
- **1h** - Snooze for 1 hour
- **tomorrow** - Snooze until 9am tomorrow
- **Any text** - Add as comment to task

### Testing

1. Enable WhatsApp in settings
2. Click "Send Test Message" to verify setup
3. Create a task with a reminder
4. Manually trigger: `POST /api/cron/reminders`

## How It Works

### Reminder Flow
1. Task created with reminder date/time
2. Cron job checks every 5 minutes for due reminders
3. WhatsApp message sent when reminder is due
4. User can reply to interact with task
5. System updates task based on reply

### Smart Prioritization
- **High priority tasks**: Immediate WhatsApp notification
- **Overdue tasks**: Sent with urgency indicator
- **Regular reminders**: Sent at specified time
- **Low priority**: Can be batched or sent via email

## Architecture

```
User → Email → Task Created → Reminder Set
                ↓
         Cron Job (every 5 min)
                ↓
         Check Due Reminders
                ↓
         Send WhatsApp Message
                ↓
         User Reply → Webhook
                ↓
         Update Task
```

## Files Created/Modified

- `/lib/whatsapp.ts` - WhatsApp integration library
- `/app/api/webhooks/whatsapp/route.ts` - Webhook for replies
- `/app/api/user/whatsapp/route.ts` - Settings management
- `/app/api/cron/reminders/route.ts` - Cron job endpoint
- `/prisma/schema.prisma` - Added phone number fields
- `/app/(dashboard)/dashboard/page.tsx` - Settings UI

## Troubleshooting

### Message not sending
- Check Twilio credentials in `.env`
- Verify phone number format (+country code)
- Ensure number is registered with WhatsApp
- Check Twilio console for errors

### Webhook not receiving
- Verify webhook URL in Twilio
- Check NGROK if testing locally
- Review webhook logs in Twilio console

### Reminders not triggering
- Verify cron job is running
- Check task has reminderDate set
- Ensure user has WhatsApp enabled
- Check server logs for errors

## Cost

- **Twilio WhatsApp**: ~$0.005 per message
- **Free tier**: 1000 messages/month with WhatsApp Business API
- **Recommended**: Start with Twilio sandbox (free for testing)

## Security Notes

1. Phone numbers are stored encrypted
2. Webhook validates Twilio signature (optional)
3. Cron endpoint protected by secret
4. User verification required before enabling

## Future Enhancements

- [ ] Rich media messages (images, buttons)
- [ ] Group notifications
- [ ] Voice call reminders for critical tasks
- [ ] SMS fallback if WhatsApp fails
- [ ] Custom reminder schedules
- [ ] Timezone support
