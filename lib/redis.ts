import Redis from 'ioredis'

let redisClient: Redis | null = null

export function getRedis(): Redis {
  if (redisClient) return redisClient

  const url = process.env.REDIS_URL
  if (!url) {
    console.error('REDIS_URL is not set - Redis features will be disabled')
    throw new Error('REDIS_URL is not set')
  }

  console.log('Connecting to Redis:', url.replace(/:[^:@]+@/, ':****@')) // Log URL without password

  // Use lazy singleton
  redisClient = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('Redis connection failed after 10 retries')
        return null // Stop retrying
      }
      const delay = Math.min(times * 50, 2000)
      console.log(`Retrying Redis connection in ${delay}ms (attempt ${times})`)
      return delay
    },
  })

  // Connect immediately (can be awaited by callers if needed)
  redisClient.connect().catch((err) => {
    console.error('Initial Redis connection failed:', err)
  })

  redisClient.on('error', (err) => {
    console.error('Redis error:', err)
  })

  redisClient.on('connect', () => {
    console.log('Successfully connected to Redis')
  })

  return redisClient
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}


