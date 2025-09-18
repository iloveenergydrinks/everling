import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Define our task command schema
const TaskCommandSchema = z.object({
  action: z.enum(['create', 'update', 'search', 'bulk', 'unknown']),
  
  // For creating a single task
  createTask: z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    dueDate: z.string().optional(), // Will parse natural language dates
    reminderDate: z.string().optional(),
    assignedTo: z.string().optional(),
  }).optional(),
  
  // For bulk operations
  bulkAction: z.object({
    operation: z.enum(['delete', 'complete', 'archive']),
    filter: z.string(), // e.g., "all", "today", "overdue", "from kevin"
    count: z.number().optional(),
  }).optional(),
  
  // For search/filter
  search: z.object({
    query: z.string(),
    filters: z.array(z.string()).optional(),
  }).optional(),
  
  // Confidence and reasoning
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { prompt, context } = await request.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt' },
        { status: 400 }
      );
    }

    // Get current date for context
    const now = new Date();
    const dateContext = `Today is ${now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}. Current time: ${now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })}.`;

    // Generate structured command from natural language
    const result = await generateObject({
      model: anthropic('claude-3-5-haiku-20241022'),
      schema: TaskCommandSchema,
      system: `You are an intelligent task management assistant that understands ALL languages and contexts.
      
${dateContext}

Your job is to understand what the user wants to do, regardless of language or phrasing.

IMPORTANT: Be VERY smart about understanding intent:
- If someone says ANYTHING that sounds like they want to remember something, create a task
- If they mention doing something in the future, create a task
- If they mention someone's name and an action, create a task
- Understand reminders in ANY language (ricordami, recuérdame, rappelle-moi, etc.)
- Understand context: "mail to valeria" means "send email to Valeria"

For task creation:
- Extract a clear, action-oriented title
- Keep names of people mentioned (like Valeria, Kevin, etc.)
- Parse dates in any language (domani, mañana, demain = tomorrow)
- Detect urgency from tone and words
- Set action to "create" with high confidence if it seems like they want to track something

For searches:
- If they're asking about existing tasks or looking for information
- Set action to "search"

For bulk operations:
- Only if explicitly trying to delete/complete multiple tasks
- Set action to "bulk"

Default to "create" if there's ANY doubt - better to offer to create a task than miss the intent.
Set action to "unknown" ONLY if the input makes no sense at all.`,
      prompt: `Understand this request and extract the appropriate action: "${prompt}"
      
User: ${session.user.email}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Remember: When in doubt, assume they want to create a task to remember something.`,
    });

    // Add user context to the result
    const command = {
      ...result.object,
      userEmail: session.user.email,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(command);

  } catch (error) {
    console.error('AI Command error:', error);
    
    // Check if it's an API key issue
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'AI service not configured properly' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to process command' },
      { status: 500 }
    );
  }
}
