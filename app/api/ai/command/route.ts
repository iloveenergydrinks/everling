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
    dueTime: z.string().optional(), // Separate time field if needed (HH:MM format)
    reminderDate: z.string().optional(),
    assignedTo: z.string().optional(),
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
- Extract whatever details you can
- Understand dates in ANY language (domani = tomorrow, la semaine prochaine = next week, etc.)
- IMPORTANT: Extract times! "alle 4" = 16:00, "at 3pm" = 15:00, "à 14h30" = 14:30
- If time is specified, include it in dueDate as ISO 8601: "2025-09-18T16:00:00"
- If no time specified but date mentioned, use midnight: "2025-09-18T00:00:00"

For DELETION (only if explicitly asking to delete):
- Must have clear delete intent: delete, cancella, elimina, supprimer, etc.
- Set action to "delete"

For COMPLETION (only if explicitly asking to complete):
- Must have clear complete intent: complete, completa, done, fatto, etc.
- Set action to "complete"

Examples:
- "bepi" → action: "search", searchQuery: "bepi", confidence: 0.9
- "meeting" → action: "search", searchQuery: "meeting", confidence: 0.9
- "andare" → action: "search", searchQuery: "andare", confidence: 0.8
- "ricordami di" → action: "create", createTask: {title: "ricordami di"}, confidence: 0.95
- "rirocrdami di andare" → action: "create", createTask: {title: "andare"}, confidence: 0.9
- "remember to call" → action: "create", createTask: {title: "Call"}, confidence: 0.95
- "cancella task fiori" → action: "delete", targetTasks: {searchTerms: "fiori", filter: "specific"}
- "remind me to call john at 3pm" → action: "create", createTask: {title: "Call John", dueDate: "2025-09-17T15:00:00"}

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

    // If it's a create action, enhance with smart extraction (but keep it optional)
    if (command.action === 'create' && command.createTask) {
      try {
        // Only do smart extraction if we have enough content
        if (prompt.length > 10) {
          // Create email-like data from the chat input
          const emailData = {
            from: session.user.email!,
            subject: command.createTask.title || prompt,
            body: prompt,
            timestamp: new Date()
          };

          // Calculate smart priority
          const priorityScore = await calculateSmartPriority(emailData);

          // Extract full task details using the same AI as email
          const smartTasks = await extractSmartTask(
            emailData,
            null, // No thread context for chat
            priorityScore
          );

          // Get the extracted task (could be multiple, but we'll take the first)
          const smartTask = Array.isArray(smartTasks) ? smartTasks[0] : smartTasks;

          // Extract relationships
          const relationships = await extractTaskRelationships(
            emailData,
            null,
            session.user.email!
          );

          // Merge the smart extraction with the initial command (keep original if smart extraction is empty)
          command.createTask = {
            title: smartTask.title || command.createTask.title,
            description: smartTask.description || command.createTask.description,
            priority: smartTask.priority || command.createTask.priority || 'medium',
            dueDate: smartTask.dueDate?.toISOString() || command.createTask.dueDate,
            reminderDate: smartTask.reminderDate?.toISOString(),
            estimatedEffort: smartTask.estimatedEffort,
            businessImpact: smartTask.businessImpact,
            stakeholders: smartTask.stakeholders,
            projectTag: smartTask.projectTag,
            dependencies: smartTask.dependencies,
            tags: smartTask.tags,
            // Add relationships
            assignedToEmail: relationships.assignedToEmail,
            assignedByEmail: relationships.assignedByEmail,
            taskType: relationships.taskType || 'self',
            userRole: relationships.userRole || 'executor'
          };
        }
      } catch (error) {
        console.error('Smart extraction failed:', {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          prompt,
          createTask: command.createTask
        });
        // Keep the basic extraction if smart fails
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
