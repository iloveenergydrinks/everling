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

For DELETION (delete, cancella, elimina, supprimer, löschen, 删除, etc.):
- Set action to "delete"
- If they mention specific text (like "fiori", "budget", etc.), set searchTerms to that text
- If they say all/tutto/tous/alle, set filter to "all"
- If they say today/oggi/hoy/aujourd'hui, set filter to "today"
- If they say completed/completati/terminé, set filter to "completed"
- Otherwise set filter to "specific" and put the search terms in searchTerms

For COMPLETION (complete, completa, terminar, finir, etc.):
- Set action to "complete"
- Same logic as deletion for filters and search terms

For CREATION (any mention of remembering, reminding, needing to do something):
- Set action to "create"
- Extract task details
- Understand dates in ANY language (domani = tomorrow, la semaine prochaine = next week, etc.)
- IMPORTANT: Extract times! "alle 4" = 16:00, "at 3pm" = 15:00, "à 14h30" = 14:30
- If time is specified, include it in dueDate as ISO 8601: "2025-09-18T16:00:00"
- If no time specified, use midnight: "2025-09-18T00:00:00"

For SEARCH (when looking for existing tasks):
- Set action to "search"

Examples:
- "cancella task fiori" → action: "delete", targetTasks: {searchTerms: "fiori", filter: "specific"}
- "elimina tutto" → action: "delete", targetTasks: {filter: "all"}
- "delete today's tasks" → action: "delete", targetTasks: {filter: "today"}
- "completa le attività di oggi" → action: "complete", targetTasks: {filter: "today"}
- "domani alle 4 andare da michelutti" → action: "create", createTask: {title: "Andare da Michelutti", dueDate: "2025-09-18T16:00:00"}
- "remind me to call john at 3pm" → action: "create", createTask: {title: "Call John", dueDate: "2025-09-17T15:00:00"}

Default to "create" if there's ANY doubt - better to offer to create a task than miss the intent.
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

    // If it's a create action, enhance with smart extraction
    if (command.action === 'create' && command.createTask) {
      try {
        // Create email-like data from the chat input
        const emailData = {
          from: session.user.email!,
          subject: command.createTask.title,
          body: prompt, // Use the full prompt as the body
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

        // Merge the smart extraction with the initial command
        command.createTask = {
          title: smartTask.title,
          description: smartTask.description,
          priority: smartTask.priority,
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
          taskType: relationships.taskType,
          userRole: relationships.userRole
        };
      } catch (error) {
        console.error('Smart extraction failed, using basic extraction:', error);
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
