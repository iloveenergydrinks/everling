import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractSmartTask, calculateSmartPriority, extractTaskRelationships } from '@/lib/smart-agent';

// Define our task command schema
const TaskCommandSchema = z.object({
  action: z.enum(['create', 'delete', 'complete', 'update', 'search', 'unknown']),
  
  // For creating a single task
  createTask: z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    dueDate: z.string().optional(), // ISO 8601 datetime string WITH TIME if specified
    reminderDate: z.string().optional(),
    assignedTo: z.string().optional(),
    // Tags for rich context
    tags: z.object({
      who: z.string().optional(), // Person mentioned
      where: z.string().optional(), // Location mentioned
      when: z.string().optional(), // Time description
      what: z.string().optional(), // Action type
    }).optional(),
  }).optional(),
  
  // For deletion/completion
  targetTasks: z.object({
    searchTerms: z.string().optional(), // What to search for in task titles/descriptions
    filter: z.enum(['all', 'today', 'tomorrow', 'overdue', 'completed', 'specific']).optional(),
    estimatedCount: z.number().optional(),
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

IMPORTANT: Be VERY smart about understanding intent in ANY LANGUAGE:

For SEARCH (DEFAULT ACTION - use this for unclear/ambiguous input):
- This is the DEFAULT when intent is unclear
- Single words, names, partial phrases without clear action words
- Set action to "search" for general queries
- Examples: "bepi", "meeting", "tomorrow", "urgent"

For CREATION (ONLY when explicitly asking to create/remember):
- MUST have clear creation keywords: ricordami, ricorda, remember, remind, rappelle, recuérdame, 记住, etc.
- Even with TYPOS: "rirocrdami", "ricrodami", "remeber", "remmind" → still create
- Set action to "create" ONLY when these keywords are present
- Extract ALL details in ONE pass:
  - Title: Clear, action-oriented (e.g., "Call Bepi", "Meeting with Michelutti")
  - Description: Any additional context
  - Priority: Detect urgency (ASAP/urgent → high, normal → medium, whenever → low)
  - Due date AND time: Parse completely
    * "domani alle 4" → "2025-09-19T16:00:00"
    * "tomorrow at 3pm" → "2025-09-19T15:00:00"
    * "lunedì" → next Monday at midnight
  - Extract WHO is mentioned (for tags)
  - Extract WHERE if mentioned (for tags)

For DELETION (only if explicitly asking to delete):
- Must have clear delete intent: delete, cancella, elimina, supprimer, etc.
- Set action to "delete"

For COMPLETION (only if explicitly asking to complete):
- Must have clear complete intent: complete, completa, done, fatto, etc.
- Set action to "complete"

Examples:
- "bepi" → action: "search", searchQuery: "bepi", confidence: 0.9
- "meeting" → action: "search", searchQuery: "meeting", confidence: 0.9
- "ricordami di chiamare bepi domani alle 4" → action: "create", createTask: {
    title: "Chiamare Bepi",
    dueDate: "2025-09-19T16:00:00",
    tags: {who: "Bepi", when: "Tomorrow at 4 PM", what: "call"}
  }, confidence: 0.95
- "remind me to meet john at starbucks" → action: "create", createTask: {
    title: "Meet John at Starbucks",
    tags: {who: "John", where: "Starbucks", what: "meeting"}
  }, confidence: 0.95
- "cancella task fiori" → action: "delete", targetTasks: {searchTerms: "fiori", filter: "specific"}

DEFAULT TO "SEARCH" for ambiguous input - it's a search box!
Only use "create" when there are EXPLICIT creation keywords (remind, remember, ricordami, etc.)
Set action to "unknown" ONLY if the input makes no sense at all.

IMPORTANT: If creating a task but no date/time is mentioned, set dueDate to null (don't make up dates).`,
      prompt: `Understand this request and extract the appropriate action: "${prompt}"
      
User: ${session.user.email}
${context ? `Context: ${JSON.stringify(context)}` : ''}

Remember: Extract ALL information mentioned. If they say a date/time, include it. If they don't mention any date/time, leave dueDate as null.

Remember: When in doubt, assume they want to create a task to remember something.`,
    });

    // Add user context to the result
    let command = {
      ...result.object,
      userEmail: session.user.email,
      timestamp: new Date().toISOString(),
    };

    // For chat commands, we already have the extraction from the first AI call
    // Skip the heavy smart extraction to keep it fast
    if (command.action === 'create' && command.createTask) {
      // Just add default values for chat-created tasks
      command.createTask = {
        ...command.createTask,
        taskType: 'self',
        userRole: 'executor',
        createdVia: 'chat'
      };
    }

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
