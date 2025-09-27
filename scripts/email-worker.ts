import 'dotenv/config'
import { Worker, QueueEvents } from 'bullmq'
import { getRedis } from '@/lib/redis'
import { processInboundEmail } from '@/lib/email'
import { logTrace, logGlobal } from '@/lib/redis-logs'

const connection = getRedis()

const worker = new Worker('inbound-email', async job => {
  const { emailData, requestId } = job.data || {}
  const rid = requestId || job.id
  console.log(`[${rid}] Worker: processing inbound email job ${job.id}`)
  await logTrace(rid, 'worker:start', { jobId: job.id })
  await logGlobal('worker:start', rid, { jobId: job.id })
  const res = await processInboundEmail(emailData)
  await logTrace(rid, 'worker:completed', { jobId: job.id, result: !!res && typeof res === 'object' ? Object.keys(res) : typeof res })
  await logGlobal('worker:completed', rid, { jobId: job.id })
  return res
}, { connection })

const events = new QueueEvents('inbound-email', { connection })
events.on('completed', ({ jobId }) => {
  console.log(`[Queue] Job completed: ${jobId}`)
})
events.on('failed', ({ jobId, failedReason }) => {
  console.error(`[Queue] Job failed: ${jobId} - ${failedReason}`)
})

worker.on('error', (err) => {
  console.error('[Worker] Error:', err)
})

console.log('[Worker] Email worker started')


