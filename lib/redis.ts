import Redis from 'ioredis'

let redisClient: Redis | null = null

export function getRedis(): Redis {
  if (redisClient) return redisClient

  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is not set')
  }

  // Use lazy singleton
  redisClient = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
    enableReadyCheck: false,
    lazyConnect: true,
  })

  // Connect immediately (can be awaited by callers if needed)
  redisClient.connect().catch(() => {})

  redisClient.on('error', (err) => {
    console.error('Redis error:', err)
  })

  return redisClient
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}


