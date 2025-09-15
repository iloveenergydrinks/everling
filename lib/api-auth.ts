import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

// Create rate limiters with different limits
const apiKeyLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 }) // 100 req/min
const sessionLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 }) // 300 req/min

export async function authenticateRequest(request: NextRequest) {
  // First try session authentication
  const session = await getServerSession(authOptions)
  if (session?.user?.organizationId) {
    return {
      authenticated: true,
      organizationId: session.user.organizationId,
      userId: session.user.id,
      method: "session" as const,
    }
  }

  // Then try API key authentication
  const apiKey = request.headers.get("x-api-key")
  if (apiKey) {
    try {
      // Hash the provided key to compare with stored hash
      const keyHash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex')

      const apiKeyRecord = await prisma.apiKey.findFirst({
        where: {
          keyHash,
        },
      })

      if (apiKeyRecord) {
        // Update last used timestamp
        await prisma.apiKey.update({
          where: {
            id: apiKeyRecord.id,
          },
          data: {
            lastUsed: new Date(),
          },
        })

        return {
          authenticated: true,
          organizationId: apiKeyRecord.organizationId,
          userId: null, // API keys don't have a specific user
          method: "apikey" as const,
        }
      }
    } catch (error) {
      console.error("Error authenticating API key:", error)
    }
  }

  return {
    authenticated: false,
    organizationId: null,
    userId: null,
    method: null,
  }
}
