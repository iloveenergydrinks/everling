import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface SmartPriorityScore {
  score: number // 0-100
  reasoning: string
  factors: {
    senderImportance: number
    urgencyLevel: number
    businessImpact: number
    timeConstraint: number
    contextualRelevance: number
  }
}

interface ThreadContext {
  conversationFlow: ConversationEvent[]
  decisions: Decision[]
  actionItems: ActionItem[]
  currentStatus: 'active' | 'waiting_response' | 'blocked' | 'resolved'
  keyParticipants: Participant[]
  projectContext: string | null
}

interface ConversationEvent {
  timestamp: Date
  sender: string
  type: 'question' | 'answer' | 'request' | 'confirmation' | 'objection' | 'decision'
  content: string
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent'
}

interface Decision {
  what: string
  who: string
  when: Date
  confidence: number
}

interface ActionItem {
  task: string
  assignee: string | null
  deadline: Date | null
  status: 'pending' | 'in_progress' | 'complete'
  dependencies: string[]
}

interface Participant {
  email: string
  role: 'requester' | 'assignee' | 'stakeholder' | 'observer'
  influence: number // 0-1
}

/**
 * AI-powered priority scoring - no keywords, pure intelligence
 */
export async function calculateSmartPriority(
  emailData: {
    from: string
    subject: string
    body: string
    timestamp: Date
  },
  senderHistory: {
    previousEmails: number
    avgResponseTime: number
    taskCompletionRate: number
    lastInteraction: Date | null
  },
  organizationContext: {
    id: string
    businessDomain: string
    teamSize: number
  }
): Promise<SmartPriorityScore> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022', // Use more powerful model for complex analysis
      max_tokens: 800,
      temperature: 0.1, // Low temperature for consistent scoring
      system: `You are an expert MULTILINGUAL email priority analyst. Score email priority from 0-100 based on sophisticated factors, handling ANY language fluently (especially Italian and English).

SCORING FRAMEWORK:

1. SENDER IMPORTANCE (0-25 points)
   - Analyze sender's role/authority from email signature, domain, writing style
   - Italian titles: "Dott.", "Ing.", "Avv.", "Prof.", "Sig.", "Studio"
   - Consider relationship to recipient (internal/external, hierarchy)
   - Evaluate based on communication patterns and formality level

2. URGENCY LEVEL (0-25 points)
   - Detect time pressure through language patterns IN ANY LANGUAGE
   - Italian urgency: "urgente", "prioritario", "entro oggi", "scadenza immediata"
   - Italian deadlines: "entro il", "scade il", "termine", "da completare entro"
   - Analyze sentence structure, punctuation, writing style
   - Consider implicit deadlines and time-sensitive contexts

3. BUSINESS IMPACT (0-25 points)
   - Assess potential business consequences of delay
   - Italian business terms: "fattura", "pagamento", "contratto", "cliente", "fornitore"
   - Italian legal/fiscal: "scadenza fiscale", "adempimento", "dichiarazione", "F24"
   - Evaluate scope of impact (personal, team, company, external)
   - Consider revenue, reputation, or operational implications

4. TIME CONSTRAINT (0-15 points)
   - Identify explicit and implicit deadlines
   - Italian time expressions: "domani", "dopodomani", "questa settimana", "entro lunedì"
   - Italian date format: DD/MM/YYYY (e.g., 18/09/2025)
   - Consider business hours, weekends, holidays (Italian holidays too)

5. CONTEXTUAL RELEVANCE (0-10 points)
   - Evaluate how this fits into current priorities
   - Consider organizational context and domain
   - Assess complexity and effort required
   - Italian context clues: "come d'accordo", "in riferimento a", "seguito ns conversazione"

MULTILINGUAL ANALYSIS RULES:
- DETECT LANGUAGE FIRST - Italian, English, or mixed
- Be culturally aware - Italian business culture may use different urgency expressions
- Understand Italian formal/informal registers (Lei/tu)
- Consider subtext and implications IN THE DETECTED LANGUAGE
- Factor in business context and relationships
- Provide reasoning in the SAME LANGUAGE as the email

Return JSON with detailed analysis.`,
      messages: [{
        role: 'user',
        content: `Analyze this email for priority scoring:

SENDER: ${emailData.from}
SUBJECT: ${emailData.subject}
TIMESTAMP: ${emailData.timestamp.toISOString()}

BODY:
${emailData.body.substring(0, 2000)}

SENDER HISTORY:
- Previous emails: ${senderHistory.previousEmails}
- Average response time: ${senderHistory.avgResponseTime} hours
- Task completion rate: ${senderHistory.taskCompletionRate}%
- Last interaction: ${senderHistory.lastInteraction?.toISOString() || 'Never'}

ORGANIZATION CONTEXT:
- Business domain: ${organizationContext.businessDomain}
- Team size: ${organizationContext.teamSize}

Provide detailed priority analysis with specific reasoning.`
      }],
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as SmartPriorityScore
        
        // Validate score is within bounds
        analysis.score = Math.max(0, Math.min(100, analysis.score))
        
        return analysis
      }
    }

    throw new Error('Invalid AI response format')
  } catch (error) {
    console.error('Smart priority calculation failed:', error)
    
    // Fallback to basic scoring
    return {
      score: 50,
      reasoning: 'AI analysis failed, using default priority',
      factors: {
        senderImportance: 25,
        urgencyLevel: 25,
        businessImpact: 25,
        timeConstraint: 15,
        contextualRelevance: 10
      }
    }
  }
}

/**
 * AI-powered thread intelligence - understands conversation flow
 */
export async function analyzeThreadContext(
  emails: Array<{
    from: string
    to: string
    subject: string
    body: string
    timestamp: Date
    messageId: string
  }>
): Promise<ThreadContext | null> {
  try {
    // Sort emails chronologically
    const sortedEmails = emails.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1200,
      temperature: 0.2,
      system: `You are an expert MULTILINGUAL conversation analyst. Analyze email threads in ANY LANGUAGE to understand:

1. CONVERSATION FLOW
   - Who is asking what from whom
   - What decisions were made and by whom
   - What action items emerged and their status
   - Current conversation status

2. PARTICIPANT ROLES
   - Who is the requester, assignee, stakeholder
   - What is each person's level of influence/authority
   - Who are the decision makers vs implementers

3. PROJECT CONTEXT
   - What project/initiative is this about
   - How does this relate to business objectives
   - What are the dependencies and blockers

4. STATUS INFERENCE
   - Is this conversation still active?
   - Are people waiting for responses?
   - Has this been resolved or completed?
   - What are the next steps?

5. ACTION ITEMS
   - What specific tasks need to be done
   - Who should do them
   - When are they due
   - What are the dependencies

MULTILINGUAL ANALYSIS (ITALIAN PRIORITY):
- DETECT THREAD LANGUAGE immediately
- Italian decision signals: "confermo", "approvato", "procedi", "d'accordo"
- Italian completion: "fatto", "completato", "risolto", "concluso"
- Italian waiting: "in attesa", "aspetto", "quando possibile"
- Italian requests: "cortesemente", "per favore", "ti/Le chiedo"
- Italian deadlines: "entro", "scadenza", "termine"
- Italian roles: "responsabile", "referente", "incaricato"

CULTURAL CONTEXT:
- Italian: More formal, relationship-focused, indirect communication
- English: Direct, task-focused, deadline-driven
- Mixed: Handle code-switching gracefully

ANALYSIS GUIDELINES:
- Read between the lines for implicit information IN THE DETECTED LANGUAGE
- Understand business context and cultural communication norms
- Identify decision points and their outcomes
- Track the evolution of requirements
- Detect completion signals IN ANY LANGUAGE

Return ONLY a valid JSON object with no additional text, markdown, or explanations. Start with { and end with }.`,
      messages: [{
        role: 'user',
        content: `Analyze this email thread:

${sortedEmails.map((email, index) => `
EMAIL ${index + 1}:
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Time: ${email.timestamp.toISOString()}

Body:
${email.body.substring(0, 1500)}

---
`).join('')}

Provide comprehensive thread analysis with conversation flow, decisions, action items, and current status.`
      }],
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as ThreadContext
        } catch (parseError) {
          console.warn('Thread analysis: Failed to parse AI JSON response, using fallback')
        }
      } else {
        console.warn('Thread analysis: No JSON found in AI response, using fallback')
      }
    }
    
    // If we get here, AI response was not valid - return null
    console.warn('Thread analysis: Invalid AI response, returning null')
    return null
  } catch (error) {
    console.error('Thread analysis failed:', error)
    
    // Fallback to basic analysis
    const participants = [...new Set(emails.map(e => e.from))]
    return {
      conversationFlow: [],
      decisions: [],
      actionItems: [],
      currentStatus: 'active',
      keyParticipants: participants.map(email => ({
        email,
        role: 'participant' as any,
        influence: 0.5
      })),
      projectContext: null
    }
  }
}

/**
 * Extract task relationships from email context
 */
export async function extractTaskRelationships(
  emailData: {
    from: string
    to: string  // The everling.io account email
    subject: string
    body: string
    timestamp: Date
  },
  organizationEmail: string, // e.g., "fisataskmanager@everling.io"
  forwardedContext?: {
    originalFrom?: string | null
    originalTo?: string | null
    originalSubject?: string | null
  }
): Promise<{
  assignedToEmail: string | null
  assignedByEmail: string | null
  taskType: 'assigned' | 'self' | 'delegation' | 'tracking' | 'fyi'
  userRole: 'executor' | 'delegator' | 'observer' | 'coordinator'
  stakeholders: Array<{ name?: string; email: string; role: string }>
}> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0.1,
      system: `You are an expert at understanding task relationships in emails across ALL languages.

CRITICAL CONTEXT UNDERSTANDING:
When analyzing forwarded emails, pay special attention to:
- If the user forwards their OWN SENT email (where they originally asked someone for something), they're likely TRACKING that request
- If the user forwards someone ELSE'S request to them, they may be delegating or just tracking
- Look for phrases like "I asked", "I requested", "I sent this to", "waiting for", "sollecitare", "in attesa di" to understand the relationship

ANALYZE WHO SHOULD DO WHAT:
1. Identify the TASK OWNER (assignedToEmail):
   - Who should actually perform this task?
   - If this is a forwarded request the user SENT to someone → assignedTo = that someone (found in forwarded To: or body)
   - If sender is requesting something from recipient → assignedTo = recipient
   - If sender is informing about their own task → assignedTo = sender
   - If user is waiting for someone's response → assignedTo = that person

2. Identify the REQUESTER (assignedByEmail):
   - Who originally asked for this to be done?
   - In forwarded emails, look at the ORIGINAL sender
   - For tracking tasks, the requester is often the user themselves

3. Classify TASK TYPE:
   - assigned: Someone gave this task to recipient
   - self: Recipient created for themselves (reminders, personal notes)
   - delegation: Recipient needs to delegate to someone else
   - tracking: Recipient is monitoring/waiting for someone else's work (COMMON for forwarded sent emails)
   - fyi: Information only, no action needed

4. Identify USER'S ROLE (perspective of the email recipient):
   - executor: They need to do the task themselves
   - delegator: They assigned it and are waiting for completion
   - observer: They're just tracking/watching
   - coordinator: They're managing multiple parties

5. Extract STAKEHOLDERS:
   - List all people mentioned who have a role
   - Include their relationship to the task

FORWARDED EMAIL PATTERNS:
- "Fwd: [subject]" where body shows "From: ${organizationEmail}" → User forwarded their own sent email → likely TRACKING
- Body contains "I sent this to Kevin" or "I asked Maria" → taskType: tracking, assignedTo: Kevin/Maria
- Italian: "Ho inviato a", "Ho chiesto a", "In attesa di risposta da" → tracking pattern
- If forwarded content shows user asking someone for something → userRole: delegator, taskType: tracking

IMPORTANT:
- Analyze from the perspective of the RECIPIENT (${organizationEmail})
- Understand the INTENT: Why did the user forward this email to themselves?
- If they're reminding themselves to follow up on a request they made → tracking
- If they're reminding themselves to read something → self

Return JSON only:
{
  "assignedToEmail": "email or null",
  "assignedByEmail": "email or null", 
  "taskType": "assigned|self|delegation|tracking|fyi",
  "userRole": "executor|delegator|observer|coordinator",
  "stakeholders": [{"name": "string", "email": "string", "role": "string"}]
}`,
      messages: [{
        role: 'user',
        content: `Analyze task relationships in this email:

FROM: ${emailData.from}
TO: ${emailData.to}
SUBJECT: ${emailData.subject}
BODY: ${emailData.body.substring(0, 2000)}

FORWARDED CONTEXT (if present):
originalFrom: ${forwardedContext?.originalFrom || 'N/A'}
originalTo: ${forwardedContext?.originalTo || 'N/A'}
originalSubject: ${forwardedContext?.originalSubject || 'N/A'}

ANALYSIS HINTS:
- If subject starts with "Fwd:" or "Fw:", this is a forwarded email
- If the body contains forwarded headers (From:, To:, Subject:), analyze the original exchange
- If the user (${emailData.to}) is forwarding their own sent email, they're likely tracking/waiting for a response
- Look for names mentioned in the body (e.g., "Kevin", "Maria") as potential assignees

Who should do this task? What's the recipient's role?`
      }]
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const relationships = JSON.parse(jsonMatch[0])
        
        // Ensure stakeholders is an array
        relationships.stakeholders = Array.isArray(relationships.stakeholders) 
          ? relationships.stakeholders 
          : []
        
        return relationships
      }
    }
    
    // Fallback if AI fails
    // Heuristic fallback for forwarded requests: if originalFrom equals current sender,
    // treat this as tracking/delegation aimed at originalTo.
    if (forwardedContext?.originalFrom && forwardedContext?.originalTo) {
      const normalizedOriginalFrom = (forwardedContext.originalFrom || '').toLowerCase()
      const normalizedSender = (emailData.from || '').toLowerCase()
      const normalizedOriginalTo = (forwardedContext.originalTo || '').toLowerCase()
      if (normalizedOriginalFrom && normalizedSender && normalizedOriginalFrom === normalizedSender) {
        return {
          assignedToEmail: normalizedOriginalTo || null,
          assignedByEmail: normalizedSender,
          taskType: 'tracking',
          userRole: 'delegator',
          stakeholders: []
        }
      }
    }

    return {
      assignedToEmail: emailData.to,
      assignedByEmail: emailData.from,
      taskType: 'assigned',
      userRole: 'executor',
      stakeholders: []
    }
    
  } catch (error) {
    console.error('Failed to extract task relationships:', error)
    // Default assumption: sender assigns to recipient
    return {
      assignedToEmail: emailData.to,
      assignedByEmail: emailData.from,
      taskType: 'assigned',
      userRole: 'executor',
      stakeholders: []
    }
  }
}

/**
 * Smart task extraction with thread context
 */
export async function extractSmartTask(
  emailData: {
    from: string
    subject: string
    body: string
    timestamp: Date
  },
  threadContext: ThreadContext | null,
  priorityScore: SmartPriorityScore
): Promise<{
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueDate: Date | null
  reminderDate: Date | null
  estimatedEffort: string
  businessImpact: string
  stakeholders: string[]
  projectTag: string | null
  dependencies: string[]
  tags?: {
    when?: string | null
    where?: string | null
    who?: string | null
    what?: string | null
    extras?: string[]
  }
}> {
  console.log('🤖 Starting AI task extraction:', {
    from: emailData.from,
    subject: emailData.subject,
    bodyLength: emailData.body?.length || 0,
    hasThreadContext: !!threadContext,
    priorityScore: Number(priorityScore?.score) || 50
  })
  try {
    console.log('🤖 Calling Claude API for task extraction...')
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      temperature: 0.2,
      system: `You are an expert MULTILINGUAL task extraction specialist. Extract comprehensive task information from emails in ANY language, with special expertise in Italian and English.

EXTRACTION PRINCIPLES:
1. ALWAYS create a task title - even for FYI emails with commands, newsletters with reminders, etc.
2. Task title must be actionable and specific IN THE ORIGINAL LANGUAGE
3. Include all relevant context in descriptions
4. Identify stakeholders and dependencies  
5. Estimate effort and business impact
6. Extract dates and deadlines intelligently
7. Tag with project/initiative if applicable

SPECIAL CASE: Forwarded newsletters/articles with reminder commands
- If email body contains "Ricordami"/"Remind me" + forwarded content
- Create title like: "Read: [Original Subject]" or "Review: [Article Title]"
- Description should mention the reminder request and key content

TAGS (for minimal display):
- when: human-readable date/time if present (e.g., "Thu, Sep 18, 2025 10:00")
- where: location if present (address, venue, city) or null
- who: primary counterpart contact name or email (not the user)
- what: short type keyword like "appointment", "meeting", "call", "payment", "doc"
- extras: array of short extra hints (e.g., reference numbers)

MULTILINGUAL SUPPORT (ITALIAN PRIORITY):
- ALWAYS detect the email language first
- Preserve original language in titles and key phrases
- Italian specific patterns:
  - Dates: DD/MM/YYYY (18/09/2025), "domani", "dopodomani", "lunedì prossimo"
  - Times: "alle ore 14:00", "ore 14.00", "h 14", "entro le 17"
  - Deadlines: "entro il", "scadenza", "da completare entro"
  - Priorities: "urgente", "prioritario", "importante", "può attendere"
  - Actions: "ricordami", "da fare", "completare", "inviare", "chiamare"
  - Locations: "presso", "in", "a", "da"
  - People: "collega", "con", "per", "dott.", "ing.", "sig."
  - References: "rif.", "prot.", "n.", "codice"
- English patterns as fallback
- Handle mixed language emails gracefully

CRITICAL REQUIREMENTS:
- **ALWAYS return a title** - NEVER return undefined or null for title
- If the email seems like FYI/newsletter but has a command (like "Ricordami"), create a reminder title
- For forwarded content with commands (e.g., "Ricordami domani di leggerlo"), use: "Reminder: [subject]" as title
- Even if content is a newsletter/article, if there's a reminder command, treat it as a task needing action
- **ALWAYS return a description** - extract key content or use the command text
- Always return a top-level "tags" with best-effort values from the email content
- If a precise ISO due date/time can be inferred, set dueDate and also set tags.when to a readable version
- The response MUST include valid title and description fields, even for low-priority emails

PRIORITY MAPPING (based on AI priority score):
- 0-30: low
- 31-70: medium  
- 71-100: high

EFFORT ESTIMATION:
- quick: < 1 hour (simple requests, approvals)
- medium: 1-8 hours (reviews, analysis, coordination)
- complex: > 8 hours (projects, research, major deliverables)

BUSINESS IMPACT:
- low: Internal, personal, nice-to-have
- medium: Team affecting, process improvement
- high: Revenue affecting, customer facing, critical operations

REQUIRED JSON STRUCTURE (all fields must be present):
{
  "title": "string - REQUIRED, NEVER null/undefined",
  "description": "string - REQUIRED, NEVER null/undefined", 
  "priority": "low|medium|high",
  "dueDate": "ISO date or null",
  "reminderDate": "ISO date or null",
  "estimatedEffort": "quick|medium|complex",
  "businessImpact": "low|medium|high",
  "stakeholders": [],
  "projectTag": "string or null",
  "dependencies": [],
  "tags": {
    "when": "string or null",
    "where": "string or null", 
    "who": "string or null",
    "what": "string or null",
    "extras": []
  }
}

NEVER return partial objects. ALWAYS include title and description even for newsletters/FYI emails.`,
      messages: [{
        role: 'user',
        content: `Extract task from this email:

EMAIL:
From: ${emailData.from}
Subject: ${emailData.subject}
Body: ${emailData.body.substring(0, 6000)}
Timestamp: ${emailData.timestamp.toISOString()}

CONTEXT:
Priority Score: ${Number(priorityScore?.score) || 50}/100
${emailData.body.toLowerCase().includes('ricordami') || emailData.body.toLowerCase().includes('remind') ? 
'⚠️ COMMAND DETECTED: This email contains a reminder/command request. MUST create a task with proper title!' : ''}

PRIORITY ANALYSIS:
Score: ${Number(priorityScore?.score) || 50}/100
Reasoning: ${priorityScore?.reasoning || 'N/A'}

THREAD CONTEXT:
${threadContext ? `
- Conversation status: ${threadContext.currentStatus ?? 'active'}
- Key participants: ${(threadContext.keyParticipants ?? []).map(p => `${p.email} (${p.role})`).join(', ')}
- Project context: ${threadContext.projectContext || 'None identified'}
- Active action items: ${(threadContext.actionItems ?? []).length}
- Recent decisions: ${(threadContext.decisions ?? []).length}
` : 'No thread context (new conversation)'}

Extract comprehensive task information with smart analysis.`
      }],
    })

    console.log('🤖 Claude API response received, processing...')
    
    const content = message.content[0]
    if (content.type === 'text') {
      console.log('🤖 Claude response text length:', content.text.length)
      console.log('🤖 Claude response preview:', content.text.substring(0, 200) + '...')
      
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        console.log('🤖 Found JSON in response, parsing...')
        let extracted = JSON.parse(jsonMatch[0])
        // Handle nested `task` object responses
        if (extracted && typeof extracted === 'object' && extracted.task && typeof extracted.task === 'object') {
          extracted = extracted.task
        }
        // Defensive defaults to avoid undefined.map errors
        extracted.stakeholders = Array.isArray(extracted.stakeholders) ? extracted.stakeholders : []
        extracted.dependencies = Array.isArray(extracted.dependencies) ? extracted.dependencies : []
        // Ensure tags object exists with safe defaults
        if (!extracted.tags || typeof extracted.tags !== 'object') {
          extracted.tags = { when: null, where: null, who: null, what: null, extras: [] }
        } else {
          extracted.tags.when = extracted.tags.when ?? null
          extracted.tags.where = extracted.tags.where ?? null
          extracted.tags.who = extracted.tags.who ?? null
          extracted.tags.what = extracted.tags.what ?? null
          extracted.tags.extras = Array.isArray(extracted.tags.extras) ? extracted.tags.extras : []
        }

        // No fallback heuristics: rely on model to produce tags and metadata
        console.log('🤖 Extracted tags:', extracted.tags)
        console.log('🤖 Extracted task data:', {
          title: extracted.title,
          priority: extracted.priority,
          hasDueDate: !!extracted.dueDate,
          hasReminderDate: !!extracted.reminderDate
        })
        
        // Map priority score to category
        let priority: 'low' | 'medium' | 'high' = 'medium'
        if (priorityScore.score <= 30) priority = 'low'
        else if (priorityScore.score >= 71) priority = 'high'
        
        const finalTask = {
          ...extracted,
          priority,
          stakeholders: extracted.stakeholders || [],
          dependencies: extracted.dependencies || [],
          projectTag: extracted.projectTag || null,
          estimatedEffort: extracted.estimatedEffort || 'medium',
          businessImpact: extracted.businessImpact || 'medium',
          tags: extracted.tags
        }
        
        console.log('🤖 Task extraction successful:', finalTask.title)
        return finalTask
      } else {
        console.error('🤖 No JSON found in Claude response')
      }
    }

    throw new Error('Invalid AI response format')
  } catch (error) {
    console.error('Smart task extraction failed:', error)
    
    // Fallback to basic extraction
    return {
      title: emailData.subject.substring(0, 100),
      description: `From: ${emailData.from}\n\n${emailData.body}`.substring(0, 1000),
      priority: priorityScore.score >= 71 ? 'high' : priorityScore.score <= 30 ? 'low' : 'medium',
      dueDate: null,
      reminderDate: null,
      estimatedEffort: 'medium',
      businessImpact: 'medium',
      stakeholders: [emailData.from],
      projectTag: null,
      dependencies: []
    }
  }
}

/**
 * Learn sender patterns over time
 */
export async function updateSenderIntelligence(
  senderEmail: string,
  organizationId: string,
  interaction: {
    taskCreated: boolean
    priority: string
    userResponseTime: number | null
    taskCompleted: boolean
    taskCompletionTime: number | null
  }
) {
  try {
    // Find or create sender intelligence record
    let senderIntel = await prisma.senderIntelligence.findUnique({
      where: {
        organizationId_senderEmail: {
          organizationId,
          senderEmail: senderEmail.toLowerCase()
        }
      }
    })

    if (!senderIntel) {
      senderIntel = await prisma.senderIntelligence.create({
        data: {
          organizationId,
          senderEmail: senderEmail.toLowerCase(),
          totalEmails: 0,
          tasksCreated: 0,
          avgPriority: 50,
          avgResponseTime: 24,
          completionRate: 0.8,
          lastInteraction: new Date(),
          patterns: {}
        }
      })
    }

    // Update statistics
    const updates: any = {
      totalEmails: senderIntel.totalEmails + 1,
      lastInteraction: new Date()
    }

    if (interaction.taskCreated) {
      updates.tasksCreated = senderIntel.tasksCreated + 1
    }

    if (interaction.userResponseTime !== null) {
      const newAvgResponse = (
        (senderIntel.avgResponseTime * senderIntel.totalEmails) + 
        interaction.userResponseTime
      ) / (senderIntel.totalEmails + 1)
      updates.avgResponseTime = newAvgResponse
    }

    // Update sender intelligence
    await prisma.senderIntelligence.update({
      where: { id: senderIntel.id },
      data: updates
    })

  } catch (error) {
    console.error('Failed to update sender intelligence:', error)
  }
}

/**
 * Get sender history for priority calculation
 */
export async function getSenderHistory(
  senderEmail: string,
  organizationId: string
): Promise<{
  previousEmails: number
  avgResponseTime: number
  taskCompletionRate: number
  lastInteraction: Date | null
  importanceScore: number
}> {
  try {
    const senderIntel = await prisma.senderIntelligence.findUnique({
      where: {
        organizationId_senderEmail: {
          organizationId,
          senderEmail: senderEmail.toLowerCase()
        }
      }
    })

    if (!senderIntel) {
      return {
        previousEmails: 0,
        avgResponseTime: 24,
        taskCompletionRate: 0.8,
        lastInteraction: null,
        importanceScore: 50 // Default importance
      }
    }

    // Calculate importance score based on patterns
    let importanceScore = 50 // Base score

    // Higher task creation rate = more important
    const taskRate = senderIntel.tasksCreated / Math.max(senderIntel.totalEmails, 1)
    importanceScore += taskRate * 30

    // Faster avg response from user = more important
    if (senderIntel.avgResponseTime < 4) importanceScore += 20
    else if (senderIntel.avgResponseTime < 12) importanceScore += 10

    // Recent interaction = more relevant
    if (senderIntel.lastInteraction) {
      const daysSinceLastInteraction = (Date.now() - senderIntel.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceLastInteraction < 7) importanceScore += 15
      else if (daysSinceLastInteraction < 30) importanceScore += 5
    }

    importanceScore = Math.max(0, Math.min(100, importanceScore))

    return {
      previousEmails: senderIntel.totalEmails,
      avgResponseTime: senderIntel.avgResponseTime,
      taskCompletionRate: senderIntel.completionRate,
      lastInteraction: senderIntel.lastInteraction,
      importanceScore
    }
  } catch (error) {
    console.error('Failed to get sender history:', error)
    return {
      previousEmails: 0,
      avgResponseTime: 24,
      taskCompletionRate: 0.8,
      lastInteraction: null,
      importanceScore: 50
    }
  }
}

/**
 * Analyze email thread for intelligent context
 */
export async function analyzeEmailThread(
  threadId: string,
  organizationId: string
): Promise<ThreadContext | null> {
  try {
    // Get all emails in thread
    const threadEmails = await prisma.emailLog.findMany({
      where: {
        organizationId,
        OR: [
          { threadId },
          { messageId: threadId },
          { inReplyTo: threadId }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: 20 // Limit to recent emails for analysis
    })

    if (threadEmails.length === 0) {
      return null
    }

    // Prepare emails for AI analysis
    const emailsForAnalysis = threadEmails.map((email: any) => {
      const rawData = email.rawData as any
      return {
        from: email.fromEmail,
        to: email.toEmail,
        subject: email.subject,
        body: rawData?.TextBody || rawData?.HtmlBody || '',
        timestamp: email.createdAt,
        messageId: email.messageId || email.id
      }
    })

    return await analyzeThreadContext(emailsForAnalysis)
  } catch (error) {
    console.error('Failed to analyze email thread:', error)
    return null
  }
}
