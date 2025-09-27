import { Queue, type JobsOptions } from 'bullmq'
import { getRedis } from '@/lib/redis'

export type InboundEmailJob = {
  emailData: any
  requestId?: string
}

let emailQueueSingleton: Queue<InboundEmailJob> | null = null

export function getEmailQueue(): Queue<InboundEmailJob> {
  if (emailQueueSingleton) return emailQueueSingleton

  const connection = getRedis()
  emailQueueSingleton = new Queue<InboundEmailJob>('inbound-email', {
    connection,
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    }
  })
  return emailQueueSingleton
}

export async function enqueueInboundEmail(payload: InboundEmailJob, opts?: JobsOptions) {
  // Check if Redis is available
  if (!process.env.REDIS_URL) {
    throw new Error('Redis not configured - falling back to inline processing')
  }
  const q = getEmailQueue()
  const jobId = payload.emailData?.MessageID || payload.requestId || undefined
  return await q.add('process', payload, { jobId, ...opts })
}



