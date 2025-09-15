import { NextRequest } from "next/server"

// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  max: number       // Max requests per window
}

export function rateLimit(config: RateLimitConfig = { 
  windowMs: 60 * 1000, // 1 minute
  max: 100             // 100 requests per minute
}) {
  return async function checkRateLimit(identifier: string): Promise<{ 
    success: boolean
    limit: number
    remaining: number
    reset: Date
  }> {
    const now = Date.now()
    const windowStart = now - config.windowMs
    
    // Clean up old entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }

    const record = rateLimitStore.get(identifier)
    
    if (!record || record.resetTime < now) {
      // Create new window
      const resetTime = now + config.windowMs
      rateLimitStore.set(identifier, { count: 1, resetTime })
      return {
        success: true,
        limit: config.max,
        remaining: config.max - 1,
        reset: new Date(resetTime)
      }
    }

    if (record.count >= config.max) {
      // Rate limit exceeded
      return {
        success: false,
        limit: config.max,
        remaining: 0,
        reset: new Date(record.resetTime)
      }
    }

    // Increment counter
    record.count++
    rateLimitStore.set(identifier, record)
    
    return {
      success: true,
      limit: config.max,
      remaining: config.max - record.count,
      reset: new Date(record.resetTime)
    }
  }
}

// Helper to get client IP
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : 
             request.headers.get("x-real-ip") || 
             "unknown"
  return ip
}

