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
      system: `You are an intelligent task management assistant with natural language understanding. Your job is to interpret user intent and classify it into one of these actions: create, delete, complete, search, or unknown.

${dateContext}

INTENT CLASSIFICATION FRAMEWORK:

Think like a human: What does the user actually want to accomplish?

**DELETION INTENT** - User wants to remove/eliminate tasks:
- Destruction verbs: delete, remove, clear, clean, eliminate, get rid of, purge, erase
- Cleanup language: "clean up", "organize", "tidy", "declutter"
- Multilingual: elimina, cancella, rimuovi (IT), supprimer, effacer (FR), löschen, entfernen (DE), eliminar, borrar (ES)

**COMPLETION INTENT** - User wants to mark tasks as finished:
- Finish verbs: complete, finish, done, mark as done, close, wrap up
- Achievement language: "mark complete", "set as finished", "accomplish"
- Multilingual: completa, fatto, finito (IT), terminé, fini (FR), fertig, abschließen (DE), completo, terminado (ES)

**CREATION INTENT** - User wants to add new tasks:
- Creation verbs: add, create, make, new, remind me, schedule
- Future-oriented language: "need to", "have to", "should", "must"
- Multilingual: ricordami, nuovo, aggiungi (IT), rappelle-moi, nouveau (FR), erinnere mich, neu (DE), recuérdame, nuevo (ES)

**SEARCH INTENT** - User wants to find/view existing tasks:
- Query verbs: show, find, list, display, what, which, where
- Information seeking: "what do I have", "show me", "find my", "list all"

DYNAMIC REASONING:
1. Analyze the VERB and its intent (destroy vs view vs create vs finish)
2. Consider the CONTEXT (what follows the verb)
3. Apply COMMON SENSE (cleanup = removal, questions = search)
4. Use SEMANTIC UNDERSTANDING across all languages

TARGET IDENTIFICATION:
- Past-due tasks: "expired", "overdue", "late", "past due", "scaduti", "vencidos", "expirés"
- Completed tasks: "done", "complete", "finished", "fatto", "completo", "terminé"
- Time-based: "today", "yesterday", "this week", "old"
- All tasks: "all", "everything", "tutti", "todos", "tout"
- Specific content: any specific words mentioned

CONFIDENCE SCORING:
- 0.9+: Clear intent with strong verbs
- 0.7-0.9: Reasonably clear intent
- 0.5-0.7: Ambiguous, use context clues
- <0.5: Default to search

Let the AI model reason naturally about intent rather than following rigid patterns.`,
      prompt: `Request: "${prompt}"

Think step by step:

1. What is the main VERB or ACTION the user wants?
2. What TARGET are they referring to (which tasks)?
3. What is their ultimate GOAL?

For example:
- "wipe out old tasks" → VERB: wipe out (destruction) → TARGET: old tasks → GOAL: remove them → DELETE
- "show my overdue stuff" → VERB: show (display) → TARGET: overdue tasks → GOAL: view them → SEARCH
- "remind me to call mom" → VERB: remind (future action) → TARGET: new task → GOAL: create reminder → CREATE
- "finish expired tasks" → VERB: finish (complete) → TARGET: expired tasks → GOAL: mark done → COMPLETE

Use natural language understanding to determine intent. The AI model is smart enough to understand context without rigid rules.

User: ${session.user.email}
${context ? `Context: ${JSON.stringify(context)}` : ''}`,
    });

    // Build the response with user context and metadata
    const response = {
      ...result.object,
      userEmail: session.user.email,
      timestamp: new Date().toISOString(),
      // Add metadata for task creation
      ...(result.object.action === 'create' && {
        metadata: {
          taskType: 'self',
          userRole: 'executor',
          createdVia: 'chat'
        }
      })
    };

    return NextResponse.json(response);

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
