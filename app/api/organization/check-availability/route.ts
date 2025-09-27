import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const name = searchParams.get('name')

    if (!name || name.length < 3) {
      return NextResponse.json(
        { available: false, error: 'Name must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Check if the email prefix is already taken
    const existing = await prisma.organization.findUnique({
      where: { emailPrefix: name }
    })

    if (existing) {
      // Generate suggestions if name is taken
      const suggestions = await generateSuggestions(name)
      return NextResponse.json({
        available: false,
        suggestions
      })
    }

    return NextResponse.json({
      available: true
    })

  } catch (error) {
    console.error('Error checking availability:', error)
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}

async function generateSuggestions(baseName: string): Promise<string[]> {
  const suggestions: string[] = []
  const suffixes = ['team', 'org', 'work', 'tasks', 'hub']
  const year = new Date().getFullYear().toString().slice(-2)
  
  // Try with numbers
  for (let i = 1; i <= 3; i++) {
    const candidate = `${baseName}${i}`
    const exists = await prisma.organization.findUnique({
      where: { emailPrefix: candidate }
    })
    if (!exists) {
      suggestions.push(candidate)
    }
  }

  // Try with year
  const withYear = `${baseName}${year}`
  const yearExists = await prisma.organization.findUnique({
    where: { emailPrefix: withYear }
  })
  if (!yearExists) {
    suggestions.push(withYear)
  }

  // Try with suffixes
  for (const suffix of suffixes) {
    const candidate = `${baseName}-${suffix}`
    if (candidate.length > 20) continue // Skip if too long
    
    const exists = await prisma.organization.findUnique({
      where: { emailPrefix: candidate }
    })
    if (!exists) {
      suggestions.push(candidate)
    }
    
    if (suggestions.length >= 5) break
  }

  return suggestions.slice(0, 5)
}
