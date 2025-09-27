import { getRedis } from '@/lib/redis'

const DEFAULT_TTL_SECONDS = Number(process.env.PROCESS_LOG_TTL_SECONDS || 24 * 60 * 60)
const GLOBAL_LIST_MAX = Number(process.env.PROCESS_LOG_GLOBAL_MAX || 500)

export async function logTrace(traceId: string, event: string, data?: Record<string, any>) {
  try {
    if (!traceId) return
    const redis = getRedis()
    const key = `processing:trace:${traceId}`
    const entry = JSON.stringify({ ts: new Date().toISOString(), event, data: data || {} })
    await redis.rpush(key, entry)
    await redis.expire(key, DEFAULT_TTL_SECONDS)
  } catch (e) {
    console.error('Redis logTrace error:', e)
  }
}

export async function logGlobal(event: string, traceId: string, data?: Record<string, any>) {
  try {
    const redis = getRedis()
    const key = 'processing:latest'
    const entry = JSON.stringify({ ts: new Date().toISOString(), event, traceId, data: data || {} })
    await redis.lpush(key, entry)
    await redis.ltrim(key, 0, GLOBAL_LIST_MAX - 1)
  } catch (e) {
    console.error('Redis logGlobal error:', e)
  }
}



