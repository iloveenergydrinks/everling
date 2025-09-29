import { prisma } from './prisma'

/**
 * Resolve an assignee identifier (email, name, or @mention) to a user in the organization
 */
export async function resolveAssignee(
  identifier: string,
  organizationId: string
): Promise<{ userId: string; email: string; name: string } | null> {
  if (!identifier || !organizationId) return null

  // Clean up the identifier
  const cleaned = identifier.trim().toLowerCase().replace('@', '')
  
  try {
    // First, try to find by exact email match
    if (cleaned.includes('@')) {
      const memberByEmail = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          user: {
            email: {
              equals: cleaned,
              mode: 'insensitive'
            }
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
      
      if (memberByEmail?.user) {
        return {
          userId: memberByEmail.user.id,
          email: memberByEmail.user.email!,
          name: memberByEmail.user.name || memberByEmail.user.email!
        }
      }
    }
    
    // Try to find by name (partial match)
    const memberByName = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: {
          OR: [
            {
              name: {
                contains: cleaned,
                mode: 'insensitive'
              }
            },
            {
              email: {
                startsWith: cleaned,
                mode: 'insensitive'
              }
            }
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
    
    if (memberByName?.user) {
      return {
        userId: memberByName.user.id,
        email: memberByName.user.email!,
        name: memberByName.user.name || memberByName.user.email!
      }
    }
    
    return null
  } catch (error) {
    console.error('Error resolving assignee:', error)
    return null
  }
}

/**
 * Extract assignment from email content
 */
export function extractAssignment(
  subject: string,
  body: string
): { assignee: string | null; confidence: number } {
  const text = `${subject} ${body}`.toLowerCase()
  
  // Patterns to look for (ordered by confidence)
  const patterns = [
    // Explicit assignment commands
    { regex: /assign\s+to\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, confidence: 0.95 },
    { regex: /assigned\s+to\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, confidence: 0.95 },
    { regex: /delegate\s+to\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, confidence: 0.95 },
    
    // @mentions in subject (high confidence)
    { regex: /^[^@]*@([a-zA-Z0-9_.-]+)/, confidence: 0.9, source: 'subject' },
    
    // Arrow notation
    { regex: /->\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, confidence: 0.85 },
    { regex: /->\s*@?([a-zA-Z][a-zA-Z0-9_.-]*)/i, confidence: 0.8 },
    
    // "for" patterns
    { regex: /\bfor\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, confidence: 0.75 },
    { regex: /\bfor\s+@?([a-zA-Z][a-zA-Z0-9_.-]*)\b/i, confidence: 0.7 },
    
    // @mentions in body (lower confidence)
    { regex: /@([a-zA-Z][a-zA-Z0-9_.-]*)/i, confidence: 0.6 }
  ]
  
  for (const pattern of patterns) {
    const source = pattern.source === 'subject' ? subject : text
    const match = source.match(pattern.regex)
    if (match && match[1]) {
      return {
        assignee: match[1].trim(),
        confidence: pattern.confidence
      }
    }
  }
  
  return { assignee: null, confidence: 0 }
}

/**
 * Process task assignment for email-created tasks
 */
export async function processTaskAssignment(
  emailData: {
    from: string
    to: string
    subject: string
    body: string
  },
  organizationId: string,
  creatorEmail: string
): Promise<{
  assignedToId: string | null
  assignedToEmail: string | null
  assignedByEmail: string | null
  taskType: 'assigned' | 'self' | 'delegation' | 'tracking'
  userRole: 'executor' | 'delegator' | 'observer'
}> {
  // Extract potential assignment from email
  const { assignee, confidence } = extractAssignment(emailData.subject, emailData.body)
  
  if (assignee && confidence > 0.6) {
    // Try to resolve the assignee within the organization
    const resolved = await resolveAssignee(assignee, organizationId)
    
    if (resolved) {
      console.log(`📧 Task assignment detected: ${assignee} -> ${resolved.name} (confidence: ${confidence})`)
      
      // Get the creator's user ID
      const creator = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          user: {
            email: {
              equals: creatorEmail,
              mode: 'insensitive'
            }
          }
        },
        include: {
          user: {
            select: {
              id: true
            }
          }
        }
      })
      
      return {
        assignedToId: resolved.userId,
        assignedToEmail: resolved.email,
        assignedByEmail: creatorEmail,
        taskType: 'assigned',
        userRole: 'delegator'
      }
    } else {
      console.log(`📧 Could not resolve assignee "${assignee}" in organization`)
    }
  }
  
  // Default: self-assigned task
  const selfAssigned = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      user: {
        email: {
          equals: creatorEmail,
          mode: 'insensitive'
        }
      }
    },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      }
    }
  })
  
  return {
    assignedToId: selfAssigned?.user.id || null,
    assignedToEmail: selfAssigned?.user.email || creatorEmail,
    assignedByEmail: creatorEmail,
    taskType: 'self',
    userRole: 'executor'
  }
}

