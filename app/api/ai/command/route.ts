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
  
  // For creating tasks (single or multiple)
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
  
  // For creating multiple tasks
  createTasks: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    dueDate: z.string().optional(),
    reminderDate: z.string().optional(),
    assignedTo: z.string().optional(),
    tags: z.object({
      who: z.string().optional(),
      where: z.string().optional(),
      when: z.string().optional(),
      what: z.string().optional(),
    }).optional(),
  })).optional(),
  
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

CRITICAL DISTINCTION - Search vs Create:

For SEARCH/FILTER (DEFAULT ACTION - use this for queries about existing tasks):
- This is the DEFAULT when intent is unclear
- Looking for existing tasks: "task per domani", "tasks for tomorrow", "what's due today"
- Filtering by time: "oggi", "domani", "tomorrow", "next week", "overdue"
- Filtering by person: "bepi", "john's tasks", "assigned to me"
- Filtering by status: "completed", "pending", "urgent tasks"
- Questions about tasks: "what do I have", "show me", "list", "find"
- Set action to "search" for ALL these cases

For CREATION (ONLY when explicitly asking to create NEW tasks):
- MUST have EXPLICIT creation intent, not just mentioning time/date
- Clear creation keywords: "ricordami di", "remind me to", "add task", "create", "nuovo task"
- The intent is to ADD something new, not find something existing
- Examples:
  * "ricordami di chiamare bepi" → CREATE (explicit "ricordami di")
  * "task per domani" → SEARCH (looking for tomorrow's tasks)
  * "comprare latte domani" → SEARCH (no explicit creation keyword)
  * "add task buy milk" → CREATE (explicit "add task")

DETECT MULTIPLE TASKS:
- Look for lists, commas, "and", "poi", "e", "y", "et", numbered items
- Examples of multiple tasks:
  * "remind me to call john and send email to mary"
  * "ricordami di chiamare bepi, comprare latte e pagare bollette"
  * "1. buy milk 2. call dentist 3. finish report"
- If multiple tasks detected, use createTasks array
- If single task, use createTask object

Extract ALL details in ONE pass for EACH task:
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
- "bepi" → action: "search", search: {query: "bepi"}, confidence: 0.9
- "meeting" → action: "search", search: {query: "meeting"}, confidence: 0.9
- "task per domani" → action: "search", search: {query: "tomorrow"}, confidence: 0.95
- "tasks for today" → action: "search", search: {query: "today"}, confidence: 0.95
- "cosa devo fare oggi" → action: "search", search: {query: "today"}, confidence: 0.9
- "overdue tasks" → action: "search", search: {query: "overdue"}, confidence: 0.95
- "ricordami di chiamare bepi domani alle 4" → action: "create", createTask: {
    title: "Chiamare Bepi",
    dueDate: "2025-09-19T16:00:00",
    tags: {who: "Bepi", when: "Tomorrow at 4 PM", what: "call"}
  }, confidence: 0.95
- "add task buy milk" → action: "create", createTask: {title: "Buy milk"}, confidence: 0.95
- "nuovo task: meeting con cliente" → action: "create", createTask: {title: "Meeting con cliente"}, confidence: 0.9
- "remind me to call john and buy milk" → action: "create", createTasks: [
    {title: "Call John", tags: {who: "John", what: "call"}},
    {title: "Buy milk", tags: {what: "shopping"}}
  ], confidence: 0.95
- "cancella task fiori" → action: "delete", targetTasks: {searchTerms: "fiori", filter: "specific"}

CRITICAL RULES:
1. DEFAULT TO "SEARCH" - it's primarily a search box!
2. Only use "create" when there are EXPLICIT creation keywords (remind me, ricordami di, add task, create, nuovo)
3. Just mentioning time/date is NOT enough for creation - "domani" alone means search for tomorrow's tasks
4. Set action to "unknown" ONLY if the input makes no sense at all

IMPORTANT: If creating a task but no date/time is mentioned, set dueDate to null (don't make up dates).`,
      prompt: `Understand this request and extract the appropriate action: "${prompt}"
      
User: ${session.user.email}
${context ? `Context: ${JSON.stringify(context)}` : ''}

CRITICAL: This is primarily a SEARCH box. Default to "search" unless there's an EXPLICIT creation request.
- "task per domani" = SEARCH for tomorrow's tasks
- "ricordami di X" = CREATE a new task
- Just mentioning dates/times without creation keywords = SEARCH

Remember: Extract ALL information mentioned. If they say a date/time, include it. If they don't mention any date/time, leave dueDate as null.`,
    });

    // Add user context to the result
    let command = {
      ...result.object,
      userEmail: session.user.email,
      timestamp: new Date().toISOString(),
    };

    // For chat commands, we already have the extraction from the first AI call
    // Skip the heavy smart extraction to keep it fast
    if (command.action === 'create') {
      if (command.createTask) {
        // Single task - add default values
        command.createTask = {
          ...command.createTask,
          taskType: 'self',
          userRole: 'executor',
          createdVia: 'chat'
        };
      } else if (command.createTasks) {
        // Multiple tasks - add default values to each
        command.createTasks = command.createTasks.map(task => ({
          ...task,
          taskType: 'self',
          userRole: 'executor',
          createdVia: 'chat'
        }));
      }
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
