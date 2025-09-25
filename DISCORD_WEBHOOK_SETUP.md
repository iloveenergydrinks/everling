# Discord Webhook Setup for Slash Commands

## Step 1: Go to Discord Developer Portal
1. Visit https://discord.com/developers/applications
2. Select your application (Everling)

## Step 2: Configure Interactions Endpoint URL
1. In the left sidebar, click on **"General Information"**
2. Look for **"Interactions Endpoint URL"**
3. Enter your webhook URL:
   - For local testing: Use ngrok or similar tunnel service
   - For production: `https://your-domain.com/api/webhooks/discord`
   - For Railway: `https://your-app.up.railway.app/api/webhooks/discord`

## Step 3: Get Your Public Key
1. In **General Information**, find **"Public Key"**
2. Copy this key
3. Add it to your `.env` file:
   ```
   DISCORD_PUBLIC_KEY=your_public_key_here
   ```

## Step 4: Save the Endpoint
1. After entering the webhook URL, click **"Save Changes"**
2. Discord will send a verification ping to your endpoint
3. Your app must respond with `{"type": 1}` to verify

## Step 5: Test the Commands
1. Go to any Discord server where your bot is present
2. Type `/` and you should see your commands
3. Try `/setchannel` or `/digest`

## Alternative: Use Mentions (Always Works)
While setting up webhooks, you can always use:
- `@Everling setchannel` - Set channel for digests
- `@Everling digest` - Get your digest

## Troubleshooting
- If verification fails, check that your webhook endpoint is publicly accessible
- Ensure DISCORD_PUBLIC_KEY is set correctly in your environment
- Check that your webhook route responds to type 1 (ping) with `{"type": 1}`
