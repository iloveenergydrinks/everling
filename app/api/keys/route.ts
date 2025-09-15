import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// GET /api/keys - List API keys for the organization
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        lastUsed: true,
        createdAt: true,
        keyHash: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Add key hints for display (using first 8 chars of hash as identifier)
    const apiKeysWithHints = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
      keyHint: key.keyHash.substring(0, 8), // Use hash prefix as hint
    }))

    return NextResponse.json(apiKeysWithHints)
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    )
  }
}

// POST /api/keys - Create a new API key
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name } = await request.json()
    
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    // Generate a secure random API key
    const keyValue = `sk_${crypto.randomBytes(32).toString('hex')}`
    
    // Hash the key for storage (we only store the hash)
    const keyHash = crypto
      .createHash('sha256')
      .update(keyValue)
      .digest('hex')

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        organizationId: session.user.organizationId,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    })

    // Return the full key only once (user must save it)
    return NextResponse.json({
      ...apiKey,
      key: keyValue, // Only returned on creation
    })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    )
  }
}
