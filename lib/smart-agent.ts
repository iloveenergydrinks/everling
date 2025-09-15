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
      system: `You are an expert email priority analyst. Your job is to score email priority from 0-100 based on multiple sophisticated factors, without using simple keyword matching.

SCORING FRAMEWORK:

1. SENDER IMPORTANCE (0-25 points)
   - Analyze sender's role/authority from email signature, domain, writing style
   - Consider relationship to recipient (internal/external, hierarchy)
   - Evaluate based on communication patterns and formality

2. URGENCY LEVEL (0-25 points)
   - Detect time pressure through language patterns, not just keywords
   - Analyze sentence structure, punctuation, writing style
   - Consider implicit deadlines and time-sensitive contexts

3. BUSINESS IMPACT (0-25 points)
   - Assess potential business consequences of delay
   - Evaluate scope of impact (personal, team, company, external)
   - Consider revenue, reputation, or operational implications

4. TIME CONSTRAINT (0-15 points)
   - Identify explicit and implicit deadlines
   - Assess urgency based on timeline context
   - Consider business hours, weekends, holidays

5. CONTEXTUAL RELEVANCE (0-10 points)
   - Evaluate how this fits into current priorities
   - Consider organizational context and domain
   - Assess complexity and effort required

ANALYSIS RULES:
- Be nuanced - avoid simple keyword detection
- Consider subtext and implications
- Analyze writing style and tone for urgency signals
- Factor in business context and relationships
- Provide specific reasoning for your scoring

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
): Promise<ThreadContext> {
  try {
    // Sort emails chronologically
    const sortedEmails = emails.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1200,
      temperature: 0.2,
      system: `You are an expert conversation analyst. Analyze email threads to understand:

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

ANALYSIS GUIDELINES:
- Read between the lines for implicit information
- Understand business context and relationships
- Identify decision points and their outcomes
- Track the evolution of requirements
- Detect completion signals (thanks, confirmed, done, etc.)

Return detailed JSON analysis.`,
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
        return JSON.parse(jsonMatch[0]) as ThreadContext
      }
    }

    throw new Error('Invalid AI response format')
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
}> {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      temperature: 0.2,
      system: `You are an expert task extraction specialist. Extract comprehensive task information from emails using advanced context understanding.

EXTRACTION PRINCIPLES:
1. Create actionable, specific task titles
2. Include all relevant context in descriptions
3. Identify stakeholders and dependencies
4. Estimate effort and business impact
5. Extract dates and deadlines intelligently
6. Tag with project/initiative if applicable

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

Return comprehensive JSON with all extracted information.`,
      messages: [{
        role: 'user',
        content: `Extract task from this email:

EMAIL:
From: ${emailData.from}
Subject: ${emailData.subject}
Body: ${emailData.body.substring(0, 2000)}
Timestamp: ${emailData.timestamp.toISOString()}

PRIORITY ANALYSIS:
Score: ${priorityScore.score}/100
Reasoning: ${priorityScore.reasoning}

THREAD CONTEXT:
${threadContext ? `
- Conversation status: ${threadContext.currentStatus}
- Key participants: ${threadContext.keyParticipants.map(p => `${p.email} (${p.role})`).join(', ')}
- Project context: ${threadContext.projectContext || 'None identified'}
- Active action items: ${threadContext.actionItems.length}
- Recent decisions: ${threadContext.decisions.length}
` : 'No thread context (new conversation)'}

Extract comprehensive task information with smart analysis.`
      }],
    })

    const content = message.content[0]
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0])
        
        // Map priority score to category
        let priority: 'low' | 'medium' | 'high' = 'medium'
        if (priorityScore.score <= 30) priority = 'low'
        else if (priorityScore.score >= 71) priority = 'high'
        
        return {
          ...extracted,
          priority,
          stakeholders: extracted.stakeholders || [],
          dependencies: extracted.dependencies || [],
          projectTag: extracted.projectTag || null,
          estimatedEffort: extracted.estimatedEffort || 'medium',
          businessImpact: extracted.businessImpact || 'medium'
        }
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
    const emailsForAnalysis = threadEmails.map(email => {
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
