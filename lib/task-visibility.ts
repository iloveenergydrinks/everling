import { prisma } from './prisma'

export type TaskVisibility = 'private' | 'assigned' | 'shared' | 'team'

interface VisibilityResult {
  visibility: TaskVisibility | 'ai-decide' // Let AI decide
  assignedToId: string | null
  sharedWith: string[] // Array of user IDs
  mentions: string[] // Raw mentions found
}

/**
 * Extract mentions from text (email subject and body)
 */
export function extractMentions(text: string): string[] {
  const mentions = new Set<string>()
  
  // First, look for plain email addresses anywhere in the text
  const plainEmailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
  const emailMatches = text.matchAll(plainEmailPattern)
  for (const match of emailMatches) {
    if (match[1] && !match[1].includes('everling.io') && !match[1].includes('postmarkapp.com')) {
      // Add the full email for matching
      mentions.add(match[1].toLowerCase())
    }
  }
  
  // Match @mentions (various formats)
  const mentionPatterns = [
    /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, // Full email with @
    /@([a-zA-Z][a-zA-Z0-9._-]*)/gi, // Username style
  ]
  
  // Also look for assignment patterns with emails
  const assignPatterns = [
    /\bassign(?:ed)?\s+to\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /\bdelegate(?:d)?\s+to\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /\bfor\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
  ]
  
  for (const pattern of assignPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        mentions.add(match[1].toLowerCase())
      }
    }
  }
  
  for (const pattern of mentionPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && !match[1].includes('everling.io') && !match[1].includes('postmarkapp.com')) {
        mentions.add(match[1].toLowerCase())
      }
    }
  }
  
  // Also look for "cc:", "to:", or "CC:" patterns
  const recipientPatterns = [
    /\bcc:\s*([^,\n]+(?:,\s*[^,\n]+)*)/gi,
    /\bto:\s*([^,\n]+(?:,\s*[^,\n]+)*)/gi,
  ]
  for (const pattern of recipientPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const people = match[1].split(',').map(p => p.trim().toLowerCase())
      people.forEach(p => {
        // Remove @ if present and add
        const cleaned = p.replace(/^@/, '')
        if (cleaned && !cleaned.includes('everling.io') && !cleaned.includes('postmarkapp.com')) {
          mentions.add(cleaned)
        }
      })
    }
  }
  
  return Array.from(mentions)
}

/**
 * Determine task visibility from email content
 */
export function detectTaskVisibility(
  subject: string,
  body: string
): VisibilityResult {
  const fullText = `${subject} ${body}`
  const subjectLower = subject.toLowerCase()
  
  // Check for explicit visibility markers
  if (subjectLower.includes('[team]') || subjectLower.includes('[all]')) {
    return {
      visibility: 'team',
      assignedToId: null,
      sharedWith: [],
      mentions: []
    }
  }
  
  if (subjectLower.includes('[private]')) {
    return {
      visibility: 'private',
      assignedToId: null,
      sharedWith: [],
      mentions: []
    }
  }
  
  // Extract all mentions
  const mentions = extractMentions(fullText)
  
  if (mentions.length === 0) {
    // No explicit mentions - let AI decide based on context
    return {
      visibility: 'ai-decide', // Let AI determine based on email context
      assignedToId: null,
      sharedWith: [],
      mentions: []
    }
  }
  
  // Check for assignment patterns
  const assignmentPatterns = [
    /\bassign(?:ed)?\s+to\s*:?\s*@?([a-zA-Z0-9._%+-]+)/i,
    /\bdelegate(?:d)?\s+to\s*:?\s*@?([a-zA-Z0-9._%+-]+)/i,
    /\b(?:for|->)\s+@?([a-zA-Z0-9._%+-]+)/i,
  ]
  
  let primaryAssignee: string | null = null
  for (const pattern of assignmentPatterns) {
    const match = fullText.match(pattern)
    if (match && match[1]) {
      primaryAssignee = match[1].toLowerCase()
      break
    }
  }
  
  // If we have a primary assignee from assignment patterns
  if (primaryAssignee) {
    // Remove primary assignee from mentions to get the shared list
    const sharedMentions = mentions.filter(m => m !== primaryAssignee)
    
    if (sharedMentions.length === 0) {
      // Only assigned to one person
      return {
        visibility: 'assigned',
        assignedToId: null, // Will be resolved later
        sharedWith: [],
        mentions: [primaryAssignee]
      }
    } else {
      // Assigned to one, shared with others
      return {
        visibility: 'shared',
        assignedToId: null, // Will be resolved later
        sharedWith: [], // Will be resolved later
        mentions: [primaryAssignee, ...sharedMentions]
      }
    }
  }
  
  // No explicit assignment but has mentions
  if (mentions.length === 1) {
    // Single mention without assignment language = assigned
    return {
      visibility: 'assigned',
      assignedToId: null,
      sharedWith: [],
      mentions
    }
  } else {
    // Multiple mentions = shared task
    return {
      visibility: 'shared',
      assignedToId: null,
      sharedWith: [],
      mentions
    }
  }
}

/**
 * Resolve mentions to actual user IDs in the organization
 */
export async function resolveMentionsToUsers(
  mentions: string[],
  organizationId: string
): Promise<{ resolved: Map<string, string>, unresolved: string[] }> {
  const resolved = new Map<string, string>() // mention -> userId
  const unresolved: string[] = []
  
  console.log(`👥 Resolving ${mentions.length} mentions for org ${organizationId}:`, mentions)
  
  // First get all org members for debugging
  const allMembers = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, email: true, name: true }
      }
    }
  })
  console.log(`👥 Organization members:`, allMembers.map(m => ({ email: m.user?.email, name: m.user?.name })))
  
  for (const mention of mentions) {
    const cleaned = mention.toLowerCase().replace('@', '')
    console.log(`👥 Trying to resolve mention: "${mention}" (cleaned: "${cleaned}")`)
    
    // Try different matching strategies
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: {
          OR: [
            // Exact email match
            { email: { equals: cleaned, mode: 'insensitive' } },
            // Email starts with mention (for first part of email)
            { email: { startsWith: `${cleaned}@`, mode: 'insensitive' } },
            // Name contains mention
            { name: { contains: cleaned, mode: 'insensitive' } },
          ]
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    })
    
    if (member?.user) {
      resolved.set(mention, member.user.id)
      console.log(`✅ Resolved "${mention}" to user ${member.user.email} (ID: ${member.user.id})`)
    } else {
      unresolved.push(mention)
      console.log(`❌ Could not resolve "${mention}"`)
    }
  }
  
  console.log(`👥 Resolution summary: ${resolved.size} resolved, ${unresolved.length} unresolved`)
  
  return { resolved, unresolved }
}

/**
 * Process task visibility for a new task
 */
export async function processTaskVisibility(
  emailData: {
    from: string
    subject: string
    body: string
    aiRelationships?: any // AI's understanding of the task relationships
  },
  organizationId: string,
  creatorUserId: string | null
): Promise<{
  visibility: TaskVisibility
  assignedToId: string | null
  sharedWith: string[]
  unresolvedMentions: string[]
}> {
  console.log(`👁️ Processing task visibility for email from ${emailData.from}`)
  console.log(`👁️ Subject: "${emailData.subject}"`)
  console.log(`👁️ Body preview: "${emailData.body.substring(0, 200)}..."`)
  
  // If AI determined this is an assigned/delegated task, use that
  if (emailData.aiRelationships?.taskType === 'assigned' || 
      emailData.aiRelationships?.taskType === 'delegation') {
    console.log(`👁️ AI detected delegation/assignment - using AI's understanding`)
    
    // The AI thinks this is assigned to someone else
    // Make it visible to the team so it can be picked up
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    })
    
    // Filter out the creator
    const otherMembers = members.filter(m => m.user?.id !== creatorUserId)
    console.log(`👁️ Found ${otherMembers.length} other members who could handle this task`)
    
    // If there's only one other member, auto-assign to them
    if (otherMembers.length === 1 && otherMembers[0].user) {
      console.log(`👁️ Auto-assigning to the only other member: ${otherMembers[0].user.email}`)
      return {
        visibility: 'assigned',
        assignedToId: otherMembers[0].user.id,
        sharedWith: creatorUserId ? [creatorUserId] : [],
        unresolvedMentions: []
      }
    }
    
    // Multiple members - make it team visible but still indicate who it's intended for
    // We'll store the intended recipient in the legacy assignedToEmail field
    return {
      visibility: 'team',
      assignedToId: null, // Not formally assigned, but intended recipient is tracked
      sharedWith: [],
      unresolvedMentions: []
    }
  }
  
  // Detect visibility from content
  const detection = detectTaskVisibility(emailData.subject, emailData.body)
  console.log(`👁️ Detection result: visibility=${detection.visibility}, mentions=${detection.mentions}`)
  
  // For team tasks or AI-decide, check if we can auto-assign
  if (detection.visibility === 'team' || detection.visibility === 'ai-decide') {
    console.log(`👁️ AI or team visibility - checking for smart assignment`)
    
    // Get all organization members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    })
    
    // Filter out the creator
    const otherMembers = members.filter(m => m.user?.id !== creatorUserId)
    console.log(`👁️ Found ${otherMembers.length} other members in organization`)
    
    // If there's only one other member, auto-assign to them
    if (otherMembers.length === 1 && otherMembers[0].user) {
      console.log(`👁️ Auto-assigning to the only other member: ${otherMembers[0].user.email}`)
      return {
        visibility: 'assigned',
        assignedToId: otherMembers[0].user.id,
        sharedWith: [creatorUserId].filter(Boolean) as string[],
        unresolvedMentions: []
      }
    }
    
    // Multiple members or no other members - keep as team task
    console.log(`👁️ Team visibility - task visible to all (${members.length} members total)`)
    return {
      visibility: 'team',
      assignedToId: null,
      sharedWith: [],
      unresolvedMentions: []
    }
  }
  
  // For private tasks, no mentions to resolve
  if (detection.visibility === 'private') {
    console.log(`👁️ Private visibility - only creator can see`)
    return {
      visibility: 'private',
      assignedToId: creatorUserId,
      sharedWith: [],
      unresolvedMentions: []
    }
  }
  
  // Resolve mentions to actual users
  const { resolved, unresolved } = await resolveMentionsToUsers(
    detection.mentions,
    organizationId
  )
  
  // Determine assigned user and shared users
  let assignedToId: string | null = null
  const sharedWith: string[] = []
  
  if (detection.visibility === 'assigned') {
    // First mention is the assignee
    if (detection.mentions.length > 0 && resolved.has(detection.mentions[0])) {
      assignedToId = resolved.get(detection.mentions[0])!
      console.log(`👁️ Assigned to user ID: ${assignedToId}`)
    } else {
      // Couldn't resolve assignee, fallback to creator
      assignedToId = creatorUserId
      console.log(`👁️ Could not resolve assignee, falling back to creator: ${creatorUserId}`)
    }
  } else if (detection.visibility === 'shared') {
    // First mention is primary assignee (if exists), rest are shared
    if (detection.mentions.length > 0) {
      const firstMention = detection.mentions[0]
      if (resolved.has(firstMention)) {
        assignedToId = resolved.get(firstMention)!
        console.log(`👁️ Primary assignee: ${assignedToId}`)
      }
      
      // Add rest to sharedWith
      for (let i = 1; i < detection.mentions.length; i++) {
        const userId = resolved.get(detection.mentions[i])
        if (userId && userId !== assignedToId) {
          sharedWith.push(userId)
          console.log(`👁️ Shared with user ID: ${userId}`)
        }
      }
    }
  }
  
  // Always include creator in sharedWith if not assignee
  if (creatorUserId && creatorUserId !== assignedToId && !sharedWith.includes(creatorUserId)) {
    sharedWith.push(creatorUserId)
    console.log(`👁️ Adding creator to sharedWith: ${creatorUserId}`)
  }
  
  console.log(`👁️ Final visibility: ${detection.visibility}, assignedTo: ${assignedToId}, sharedWith: [${sharedWith.join(', ')}]`)
  
  return {
    visibility: detection.visibility,
    assignedToId,
    sharedWith,
    unresolvedMentions: unresolved
  }
}
