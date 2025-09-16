import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { timezone } = await request.json()
    
    if (!timezone) {
      return NextResponse.json({ error: "Timezone is required" }, { status: 400 })
    }

    // Validate timezone format (basic check)
    if (!timezone.includes('/')) {
      return NextResponse.json({ error: "Invalid timezone format" }, { status: 400 })
    }

    // Update user's timezone
    const user = await prisma.user.update({
      where: { email: session.user.email },
      data: { timezone },
      select: { timezone: true }
    })

    console.log(`Updated timezone for ${session.user.email} to ${timezone}`)

    return NextResponse.json({ 
      success: true, 
      timezone: user.timezone,
      message: "Timezone updated successfully" 
    })
  } catch (error) {
    console.error("Error updating timezone:", error)
    return NextResponse.json(
      { error: "Failed to update timezone" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { timezone: true }
    })

    return NextResponse.json({ 
      timezone: user?.timezone || "America/New_York"
    })
  } catch (error) {
    console.error("Error fetching timezone:", error)
    return NextResponse.json(
      { error: "Failed to fetch timezone" },
      { status: 500 }
    )
  }
}
