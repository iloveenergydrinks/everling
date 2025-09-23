# Discord Integration Setup Guide

## Overview
The Discord integration allows Everling to act as an intelligent agent in your Discord servers, extracting tasks from conversations just like forwarding an email thread.

## Features
- **@mention processing**: Tag @Everling in any conversation to extract tasks
- **Context understanding**: Bot reads previous messages to understand the full conversation
- **Slash commands**: Quick task creation with `/task`, view tasks with `/tasks`
- **Smart extraction**: AI identifies action items, deadlines, and assignees from natural conversation
- **Thread support**: Works in channels and threads

## Setup Instructions

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "Everling" (or your preferred name)
4. Go to "Bot" section
5. Click "Add Bot"
6. Save the **Bot Token** (you'll need this)

### 2. Configure Bot Settings

In the Bot section:
- Enable "MESSAGE CONTENT INTENT" (required for reading messages)
- Enable "SERVER MEMBERS INTENT" (for user mentions)
- Set bot as "Public" if you want others to add it

### 3. Set Up OAuth2

1. Go to OAuth2 > General
2. Add redirect URL: `https://your-app-domain.com/api/integrations/discord/callback`
3. Save the **Client ID** and **Client Secret**

### 4. Environment Variables

Add these to your `.env` file:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_PUBLIC_KEY=your_public_key_here  # From General Information tab

# Discord Webhook (optional, for slash commands)
DISCORD_WEBHOOK_URL=your_webhook_url_here
```

### 5. Register Slash Commands

Create these slash commands in your Discord application:

```javascript
// /task - Create a quick task
{
  name: 'task',
  description: 'Create a quick task',
  options: [
    {
      name: 'description',
      type: 3, // STRING
      description: 'Task description',
      required: true
    },
    {
      name: 'due',
      type: 3, // STRING
      description: 'Due date (e.g., tomorrow, next week)',
      required: false
    },
    {
      name: 'priority',
      type: 3, // STRING
      description: 'Priority level',
      required: false,
      choices: [
        { name: 'High', value: 'high' },
        { name: 'Medium', value: 'medium' },
        { name: 'Low', value: 'low' }
      ]
    }
  ]
}

// /tasks - View your pending tasks
{
  name: 'tasks',
  description: 'View your pending tasks'
}

// /everling - Main bot commands
{
  name: 'everling',
  description: 'Everling bot commands',
  options: [
    {
      name: 'help',
      type: 1, // SUB_COMMAND
      description: 'Show help information'
    },
    {
      name: 'context',
      type: 1, // SUB_COMMAND
      description: 'Extract tasks from recent conversation'
    }
  ]
}
```

### 6. Add Bot to Server

Generate bot invite link:
1. Go to OAuth2 > URL Generator
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions:
   - Read Messages/View Channels
   - Send Messages
   - Read Message History
   - Add Reactions
   - Use Slash Commands
4. Copy the generated URL and open it to add the bot to your server

### 7. Database Migration

Apply the Discord fields to your database:

```bash
npx prisma db push
```

Or if you prefer to create a migration file:
```bash
npx prisma migrate dev --name add-discord-integration
```

Note: If you encounter shadow database errors, use `db push` instead.

### 8. Start the Bot

The bot initializes automatically when the app starts if `DISCORD_BOT_TOKEN` is set.

## Usage Examples

### Mention Processing
```
User1: We need to update the homepage design by Friday
User2: I can handle the hero section
User3: @Everling

Bot: ✅ Created 2 task(s):
• Update homepage design (due Friday)
• Handle hero section (assigned to User2)
```

### Quick Task Creation
```
/task description:"Review PR #123" due:"today" priority:"high"

Bot: ✅ Created task: Review PR #123 (due today)
```

### View Tasks
```
/tasks

Bot: 📋 Your pending tasks:
1. Update homepage design (due 03/15)
2. Review PR #123 (due today)
3. Handle hero section
```

## How It Works

1. **Context Extraction**: When mentioned, the bot fetches the last 50 messages from the channel
2. **AI Processing**: Messages are sent to the smart agent (same one that processes emails)
3. **Task Creation**: Identified tasks are created with proper metadata
4. **Response**: Bot confirms task creation and reacts with ✅

## Troubleshooting

### Bot not responding
- Check MESSAGE CONTENT INTENT is enabled
- Verify bot has proper permissions in the channel
- Check bot token is correct in environment variables

### Slash commands not working
- Ensure commands are registered in Discord application
- Verify DISCORD_PUBLIC_KEY is set correctly
- Check webhook endpoint is accessible

### OAuth connection failing
- Verify redirect URL matches exactly
- Check CLIENT_ID and CLIENT_SECRET are correct
- Ensure user is logged into Everling first

## Security Notes

- Bot token should never be exposed publicly
- Use environment variables for all sensitive data
- Webhook signatures are verified for slash commands
- OAuth state parameter prevents CSRF attacks
