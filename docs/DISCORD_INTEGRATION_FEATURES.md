# Discord Integration Features

## Overview
The Discord integration brings the power of Everling's intelligent task extraction to your Discord conversations. Just like forwarding an email, you can now tag @Everling in any conversation to automatically extract tasks, deadlines, and assignments.

## How It Works

### Context-Aware Processing
When you mention @Everling, the bot:
1. **Reads the conversation history** - Analyzes the last 50 messages in the channel/thread
2. **Understands context** - Identifies who said what, when, and in what context
3. **Extracts action items** - Uses the same AI that processes emails to find tasks
4. **Creates tasks automatically** - Adds them to your Everling dashboard with proper metadata

### Example Scenarios

#### Team Discussion
```
Alice: We need to redesign the landing page before the launch
Bob: I can handle the hero section and navigation
Carol: I'll work on the testimonials section
Alice: Great! Let's aim for Friday. @Everling

Everling Bot: ✅ Created 3 task(s):
• Redesign landing page (due Friday)
• Handle hero section and navigation (assigned to Bob, due Friday)  
• Work on testimonials section (assigned to Carol, due Friday)
```

#### Quick Task Creation
```
/task description:"Review PR #456" due:"today" priority:"high"

Everling Bot: ✅ Created task: Review PR #456 (due today)
```

#### Natural Language Processing
```
Dave: @Everling remind me to send the invoice tomorrow at 3pm

Everling Bot: ✅ Created task: Send the invoice (due tomorrow 3:00 PM)
```

## Commands

### Mention Commands
- **@Everling** - Extract tasks from the conversation above
- **@Everling [task description]** - Quick create a task from mention

### Slash Commands
- **/task** - Create a task with options for description, due date, and priority
- **/tasks** - View your 5 most recent pending tasks
- **/everling help** - Show all available commands
- **/everling context** - Manually trigger context extraction

## Smart Features

### Intelligent Assignment Detection
The bot understands natural language assignments:
- "John, can you handle this?" → Task assigned to John
- "I'll take care of it" → Task assigned to speaker
- "@sarah please review" → Task assigned to Sarah

### Deadline Recognition
Understands various date/time formats:
- "by Friday"
- "tomorrow at 3pm"
- "next week"
- "end of month"
- "ASAP" → High priority

### Thread Support
- Works in channels and threads
- Preserves Discord thread links as references
- Thread context is maintained in task metadata

### Multi-Task Extraction
Can extract multiple tasks from a single conversation:
- Different speakers mentioning different tasks
- Lists of action items
- Sequential dependencies

## Integration Benefits

### Seamless Workflow
- No context switching - stay in Discord
- Tasks appear in your morning digest email
- Reply to digest to complete tasks
- Discord metadata preserved for reference

### Team Collaboration
- Everyone sees task creation confirmation
- Clear assignment visibility
- Shared context from conversation
- Thread links for reference

### Smart Processing
- Duplicate detection
- Relevance scoring
- Priority inference
- Natural language understanding

## Setup Process

1. **Connect Discord Account**
   - Go to Dashboard → Integrations
   - Click "Connect Discord"
   - Authorize Everling

2. **Add Bot to Server**
   - Use the provided invite link
   - Select your server
   - Grant necessary permissions

3. **Start Using**
   - @mention the bot in any conversation
   - Use slash commands for quick tasks
   - Tasks sync to your Everling dashboard

## Privacy & Security

- Bot only reads messages when mentioned
- Conversation context is processed securely
- No messages are stored permanently
- Discord data is encrypted in transit
- You control which servers have the bot

## Tips for Best Results

1. **Be Clear About Assignments**
   - Mention people explicitly
   - Use clear action verbs
   - Specify deadlines when known

2. **Provide Context**
   - Mention the bot after key decisions
   - Include relevant details in the conversation
   - Use thread titles for project context

3. **Use Commands Appropriately**
   - Quick `/task` for simple items
   - @mention for conversation extraction
   - `/tasks` to check pending items

## Limitations

- Reads up to 50 previous messages for context
- Requires explicit mention to activate
- Cannot edit Discord messages
- Limited to text channels (no voice channel transcription)

## Coming Soon

- Recurring task detection
- Project-based task grouping
- Custom bot commands
- Voice channel summaries
- Integration with Discord events/calendar
