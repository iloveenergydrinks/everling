import { prisma } from '@/lib/prisma'

/**
 * Check if the organization needs a monthly reset and perform it if needed
 */
export async function checkAndResetMonthlyLimit(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      monthlyResetDate: true,
      monthlyTasksUsed: true,
      taskLimit: true,
      plan: true
    }
  })

  if (!org) {
    throw new Error('Organization not found')
  }

  const now = new Date()
  const resetDate = new Date(org.monthlyResetDate)
  
  // Check if we're in a new month
  const needsReset = 
    now.getMonth() !== resetDate.getMonth() || 
    now.getFullYear() !== resetDate.getFullYear()

  if (needsReset) {
    // Reset the monthly counter
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        monthlyTasksUsed: 0,
        monthlyResetDate: now
      }
    })
    
    console.log(`[Monthly Reset] Organization ${organizationId} monthly tasks reset`)
    return { ...org, monthlyTasksUsed: 0, monthlyResetDate: now }
  }

  return org
}

/**
 * Check if organization can create more tasks this month
 */
export async function canCreateTask(organizationId: string): Promise<{
  canCreate: boolean
  used: number
  limit: number
  remaining: number
  resetsIn: string
}> {
  // Check and potentially reset the monthly limit
  const org = await checkAndResetMonthlyLimit(organizationId)
  
  // Unlimited for paid plans
  if (org.plan !== 'free') {
    return {
      canCreate: true,
      used: org.monthlyTasksUsed,
      limit: -1, // Unlimited
      remaining: -1,
      resetsIn: ''
    }
  }

  const canCreate = org.monthlyTasksUsed < org.taskLimit
  const remaining = Math.max(0, org.taskLimit - org.monthlyTasksUsed)
  
  // Calculate when the limit resets
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const resetsIn = daysUntilReset === 1 ? 'tomorrow' : `in ${daysUntilReset} days`

  return {
    canCreate,
    used: org.monthlyTasksUsed,
    limit: org.taskLimit,
    remaining,
    resetsIn
  }
}

/**
 * Increment the monthly task counter
 */
export async function incrementMonthlyTaskCount(organizationId: string) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      monthlyTasksUsed: { increment: 1 },
      tasksCreated: { increment: 1 } // Keep total count too
    }
  })
}

/**
 * Get monthly usage stats for display
 */
export async function getMonthlyUsageStats(organizationId: string) {
  const stats = await canCreateTask(organizationId)
  
  // Calculate percentage used
  const percentageUsed = stats.limit > 0 
    ? Math.round((stats.used / stats.limit) * 100)
    : 0

  // Determine warning level
  let warningLevel: 'none' | 'warning' | 'critical' | 'exceeded' = 'none'
  if (stats.limit > 0) {
    if (stats.remaining === 0) warningLevel = 'exceeded'
    else if (stats.remaining <= 5) warningLevel = 'critical'
    else if (percentageUsed >= 80) warningLevel = 'warning'
  }

  return {
    ...stats,
    percentageUsed,
    warningLevel,
    message: getUsageMessage(stats, warningLevel)
  }
}

function getUsageMessage(
  stats: { used: number; limit: number; remaining: number; resetsIn: string },
  warningLevel: string
): string {
  if (stats.limit === -1) {
    return `${stats.used} tasks created this month (unlimited)`
  }

  switch (warningLevel) {
    case 'exceeded':
      return `Monthly limit reached! Upgrade to Pro for unlimited tasks. Resets ${stats.resetsIn}`
    case 'critical':
      return `⚠️ Only ${stats.remaining} tasks left this month! Resets ${stats.resetsIn}`
    case 'warning':
      return `You've used ${stats.used} of ${stats.limit} tasks this month`
    default:
      return `${stats.used} / ${stats.limit} tasks this month`
  }
}
