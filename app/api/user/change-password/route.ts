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

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Both current and new passwords are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    // Get the user's current password hash
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { password: true }
    })

    if (!user?.password) {
      return NextResponse.json(
        { error: "No password set. Please set a password first." },
        { status: 400 }
      )
    }

    // Verify the current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      )
    }

    // Hash and update to the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword }
    })

    return NextResponse.json({ 
      success: true,
      message: "Password changed successfully" 
    })

  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    )
  }
}
