import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface SearchInterpretation {
  filters: {
    // Temporal filters (computed dates)
    dueBefore?: string
    dueAfter?: string
    dueOn?: string
    createdBefore?: string
    createdAfter?: string
    
    // Temporal text search (for when tags)
    whenContains?: string[]  // Search in the 'when' tag text
    
    // Status filters
    status?: ('pending' | 'in-progress' | 'done')[]
    isOverdue?: boolean
    
    // Priority filters
    priority?: ('high' | 'medium' | 'low')[]
    
    // Content filters (semantic matching)
    topics?: string[]      // what the task is about
    people?: string[]      // who is involved
    locations?: string[]   // where it happens
    
    // Source filters
    source?: ('email' | 'manual')[]
    fromEmail?: string[]   // specific senders
    
    // Smart filters
    urgency?: 'immediate' | 'soon' | 'normal' | 'low'
    importance?: 'critical' | 'high' | 'normal' | 'low'
  }
  
  // Free text to search if no filters match well
  searchText?: string
  
  // Confidence in interpretation (0-1)
  confidence: number
  
  // Original query for caching
  originalQuery: string
}

/**
 * Interprets a natural language search query into structured filters
 * Uses the same Claude 3 Haiku model as email extraction for consistency
 */
export async function interpretSearchQuery(
  query: string,
  userContext?: {
    timezone?: string
    language?: string
    currentDate?: string
  }
): Promise<SearchInterpretation> {
  const now = new Date()
  const timezone = userContext?.timezone || 'UTC'
  const currentDate = userContext?.currentDate || now.toISOString()
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      temperature: 0.2,
      system: `You are an expert search query interpreter for a task management system.
Convert natural language queries IN ANY LANGUAGE into structured search filters.

CONTEXT:
- Current date/time: ${currentDate} (${timezone})
- Tasks have: title, description, dueDate, priority, status, tags (who/what/where/when)
- Tasks can be created from emails or manually
- User may search in ANY language - detect and understand it

TEMPORAL UNDERSTANDING:
- "today", "oggi", "今天" → dueOn: current date AND whenContains: ["today", "oggi"]
- "tomorrow", "domani", "demain" → dueOn: current date + 1 day AND whenContains: ["tomorrow", "domani"]
- Day names in ANY language ("monday", "lunedì", "lunes", "giovedì", "thursday") → 
  Set BOTH:
  1. dueOn: calculated date (e.g., '2025-09-18' for Thursday)
  2. whenContains: ["thursday", "thu", "giovedì", "18", "sep"]
  This ensures we find tasks whether they have dueDate set OR just a when tag mentioning that day
- "this week", "cette semaine" → dueAfter: start of week, dueBefore: end of week
- "overdue", "scaduto", "en retard" → isOverdue: true
- "next month", "prossimo mese" → calculate actual date range
- Relative dates: "in 3 days", "tra 3 giorni" → compute exact date

IMPORTANT: For temporal queries, ALWAYS set BOTH date filters (for dueDate field) AND 
whenContains (for text in when tags). This handles tasks that might have the date in either place.

PRIORITY/URGENCY UNDERSTANDING:
- "urgent", "urgente", "紧急" → priority: ["high"], urgency: "immediate"
- "important", "importante" → importance: "high"
- "ASAP", "quanto prima" → urgency: "immediate"
- "when you can", "quando puoi" → urgency: "low"

SEMANTIC UNDERSTANDING:
- "invoices", "fatture" → topics: ["invoice", "fattura", "billing"]
- "from John", "da Giovanni" → people: ["john", "giovanni"], fromEmail: ["*john*"]
- "meetings", "riunioni" → topics: ["meeting", "riunione", "call", "sync"]
- "stuff to read" → topics: ["newsletter", "article", "blog", "read"]

STATUS UNDERSTANDING:
- "completed", "fatto", "terminé" → status: ["done"]
- "pending", "da fare" → status: ["pending", "todo"]
- "in progress", "in corso" → status: ["in-progress"]

SMART INTERPRETATION:
- Understand intent, not just keywords
- "what did Sarah ask" → people: ["sarah"], fromEmail: ["*sarah*"]
- "important things from last week" → importance: "high", createdAfter: last week
- "tasks I'm ignoring" → status: ["pending"], createdBefore: 3+ days ago

ALWAYS return a valid JSON object with this EXACT structure:
{
  "filters": {
    // Include relevant filters here, or empty object {} if none apply
  },
  "searchText": "optional free text if needed",
  "confidence": 0.0 to 1.0
}

RULES:
1. Set confidence based on how well you understood the intent.
2. If query is too vague, use searchText for free text search.
3. NEVER return undefined or null for filters - use {} if no filters apply.
4. Day names (Monday, Lunedì, Giovedì, etc.) should ALWAYS become date filters, not searchText.
5. If searching for a specific date/day, use dueOn with the calculated ISO date.

EXAMPLES:
- Query: "giovedì" → {"filters": {"dueOn": "2025-09-18", "whenContains": ["thu", "gioved", "18", "sep"]}, "confidence": 1.0}
- Query: "next thursday" → {"filters": {"dueOn": "2025-09-18", "whenContains": ["thu", "thursday", "18"]}, "confidence": 1.0}
- Query: "tasks for thursday" → {"filters": {"dueOn": "2025-09-18", "whenContains": ["thu", "thursday"]}, "confidence": 1.0}`,
      messages: [{
        role: 'user',
        content: `Interpret this search query into filters: "${query}"`
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI')
    }

    // Parse the AI response
    let parsed: any
    try {
      parsed = JSON.parse(content.text)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content.text)
      throw parseError
    }
    
    // Ensure we have a valid structure
    const interpretation: SearchInterpretation = {
      filters: parsed.filters || {},
      searchText: parsed.searchText,
      confidence: parsed.confidence || 0.7,
      originalQuery: query
    }
    
    return interpretation
    
  } catch (error) {
    console.error('Error interpreting search query:', error)
    
    // Fallback to simple text search
    return {
      filters: {},
      searchText: query,
      confidence: 0.3,
      originalQuery: query
    }
  }
}

/**
 * Simple in-memory cache for search interpretations
 * Reduces AI calls for repeated queries
 */
const searchCache = new Map<string, { 
  interpretation: SearchInterpretation
  timestamp: number
}>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function interpretSearchWithCache(
  query: string,
  userContext?: {
    timezone?: string
    language?: string
    currentDate?: string
  }
): Promise<SearchInterpretation> {
  const cacheKey = `${query.toLowerCase()}_${userContext?.currentDate || ''}`
  
  // Check cache
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using cached search interpretation for:', query)
    return cached.interpretation
  }
  
  // Get fresh interpretation
  const interpretation = await interpretSearchQuery(query, userContext)
  
  // Cache it
  searchCache.set(cacheKey, {
    interpretation,
    timestamp: Date.now()
  })
  
  // Clean old cache entries
  if (searchCache.size > 100) {
    const entries = Array.from(searchCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < 50; i++) {
      searchCache.delete(entries[i][0])
    }
  }
  
  return interpretation
}
