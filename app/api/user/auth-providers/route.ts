import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user with their linked accounts
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true
          }
        }
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Check which auth methods are available
    const providers = {
      password: !!user.password,
      google: user.accounts.some(a => a.provider === 'google'),
      email: true // Magic links are always available
    }
    
    // Get Google account email if linked
    const googleAccount = user.accounts.find(a => a.provider === 'google')
    
    return NextResponse.json({
      providers,
      hasMultipleAuthMethods: Object.values(providers).filter(Boolean).length > 1,
      googleAccountId: googleAccount?.providerAccountId || null,
      canUnlinkGoogle: providers.google && (providers.password || providers.email)
    })
    
  } catch (error) {
    console.error('Error fetching auth providers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auth providers' },
      { status: 500 }
    )
  }
}

// DELETE endpoint to unlink a provider
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { provider } = await request.json()
    
    if (provider !== 'google') {
      return NextResponse.json(
        { error: 'Only Google provider can be unlinked' },
        { status: 400 }
      )
    }
    
    // Get user with accounts
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        accounts: true
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Check if user has another auth method
    const hasPassword = !!user.password
    const hasGoogle = user.accounts.some(a => a.provider === 'google')
    
    if (!hasGoogle) {
      return NextResponse.json(
        { error: 'Google account is not linked' },
        { status: 400 }
      )
    }
    
    if (!hasPassword) {
      return NextResponse.json(
        { error: 'Cannot unlink Google account. Please set a password first.' },
        { status: 400 }
      )
    }
    
    // Unlink Google account
    await prisma.account.deleteMany({
      where: {
        userId: user.id,
        provider: 'google'
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Google account unlinked successfully'
    })
    
  } catch (error) {
    console.error('Error unlinking provider:', error)
    return NextResponse.json(
      { error: 'Failed to unlink provider' },
      { status: 500 }
    )
  }
}

