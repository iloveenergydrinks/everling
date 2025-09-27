import { getRedis } from '@/lib/redis'

const DEFAULT_TTL_SECONDS = Number(process.env.PROCESS_LOG_TTL_SECONDS || 24 * 60 * 60)
const GLOBAL_LIST_MAX = Number(process.env.PROCESS_LOG_GLOBAL_MAX || 500)

// Check if Redis is available
function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL
}

export async function logTrace(traceId: string, event: string, data?: Record<string, any>) {
  try {
    if (!traceId || !isRedisAvailable()) return
    const redis = getRedis()
    const key = `processing:trace:${traceId}`
    const entry = JSON.stringify({ ts: new Date().toISOString(), event, data: data || {} })
    await redis.rpush(key, entry)
    await redis.expire(key, DEFAULT_TTL_SECONDS)
  } catch (e) {
    // Silently fail - logging is not critical
    if (process.env.NODE_ENV === 'development') {
      console.debug('Redis logTrace skipped:', (e as any)?.message)
    }
  }
}

export async function logGlobal(event: string, traceId: string, data?: Record<string, any>) {
  try {
    if (!isRedisAvailable()) return
    const redis = getRedis()
    const key = 'processing:latest'
    const entry = JSON.stringify({ ts: new Date().toISOString(), event, traceId, data: data || {} })
    await redis.lpush(key, entry)
    await redis.ltrim(key, 0, GLOBAL_LIST_MAX - 1)
  } catch (e) {
    // Silently fail - logging is not critical
    if (process.env.NODE_ENV === 'development') {
      console.debug('Redis logGlobal skipped:', (e as any)?.message)
    }
  }
}



