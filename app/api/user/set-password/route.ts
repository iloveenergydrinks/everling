import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { password } = await request.json()

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    // Check if user already has a password
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { password: true }
    })

    if (user?.password) {
      return NextResponse.json(
        { error: "Password already set. Use change password instead." },
        { status: 400 }
      )
    }

    // Hash and set the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ 
      success: true,
      message: "Password set successfully" 
    })

  } catch (error) {
    console.error("Error setting password:", error)
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 }
    )
  }
}
