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
      system: `You are a task management assistant. Extract structured commands from natural language input.
      
${dateContext}

When parsing dates:
- "tomorrow" = next day
- "next week" = 7 days from now
- "next Monday" = the coming Monday
- "in 2 days" = 2 days from now
- "end of month" = last day of current month

For task creation, extract:
- Clear, concise title (remove filler words like "I need to", "Remember to")
- Priority based on keywords (urgent=high, important=high, asap=high)
- Due dates from natural language
- Assigned person if mentioned

For bulk operations, identify:
- What action (delete, complete, archive)
- What filter (all, today, overdue, specific person)

If the intent is unclear, set action to "unknown" with low confidence.`,
      prompt: `Extract the command from this input: "${prompt}"
      
Context: User is ${session.user.email}
${context ? `Additional context: ${JSON.stringify(context)}` : ''}`,
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
