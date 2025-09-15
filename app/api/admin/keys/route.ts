import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
]

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const apiKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        keyHash: true,
        lastUsed: true,
        createdAt: true,
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform to include keyHint instead of full keyHash
    const transformedKeys = apiKeys.map(key => ({
      ...key,
      keyHint: key.keyHash.substring(0, 8),
      keyHash: undefined
    }))

    return NextResponse.json(transformedKeys)
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    )
  }
}
