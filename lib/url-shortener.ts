import { prisma } from '@/lib/prisma'
import { customAlphabet } from 'nanoid'

// Generate URL-safe short codes (no ambiguous characters)
const generateShortCode = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8)

export async function createShortLink(originalUrl: string, expiresInHours: number = 24): Promise<string> {
  try {
    // Quick check if table exists (will fail gracefully if not)
    try {
      await prisma.shortLink.count()
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.warn('Short links table does not exist, returning original URL')
        return originalUrl
      }
    }
    // Generate a unique short code
    let shortCode: string
    let attempts = 0
    
    do {
      shortCode = generateShortCode()
      attempts++
      
      // Check if code already exists
      const existing = await prisma.shortLink.findUnique({
        where: { shortCode }
      })
      
      if (!existing) break
    } while (attempts < 10)
    
    if (attempts >= 10) {
      throw new Error('Failed to generate unique short code')
    }
    
    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)
    
    // Create the short link
    await prisma.shortLink.create({
      data: {
        shortCode,
        originalUrl,
        expiresAt
      }
    })
    
    // Return the short URL (will be replaced with actual domain)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://everling.io'
    return `${baseUrl}/s/${shortCode}`
  } catch (error) {
    console.error('Failed to create short link:', error)
    // Fallback to original URL if shortening fails
    return originalUrl
  }
}

export async function getOriginalUrl(shortCode: string): Promise<string | null> {
  try {
    const link = await prisma.shortLink.findUnique({
      where: { shortCode }
    })
    
    if (!link) return null
    
    // Check if expired
    if (link.expiresAt < new Date()) {
      // Clean up expired link
      await prisma.shortLink.delete({
        where: { id: link.id }
      })
      return null
    }
    
    // Increment click count
    await prisma.shortLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } }
    })
    
    return link.originalUrl
  } catch (error) {
    console.error('Failed to get original URL:', error)
    return null
  }
}

export async function cleanupExpiredLinks(): Promise<void> {
  try {
    await prisma.shortLink.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    })
  } catch (error) {
    console.error('Failed to cleanup expired links:', error)
  }
}
