import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const { organizationName } = await request.json()

    if (!organizationName) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      )
    }

    const baseSlug = slugify(organizationName)
    
    // Check if organization exists
    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: { equals: organizationName, mode: 'insensitive' } },
          { slug: baseSlug },
          { emailPrefix: baseSlug }
        ]
      }
    })

    if (!existingOrg) {
      // Organization name is available
      return NextResponse.json({
        available: true,
        suggested: {
          name: organizationName,
          slug: baseSlug,
          emailPrefix: baseSlug,
          agentEmail: `${baseSlug}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`
        }
      })
    }

    // Organization exists - provide alternatives
    const suggestions = []
    
    // Generate 3 alternative suggestions
    for (let i = 1; i <= 3; i++) {
      const altSlug = `${baseSlug}-${i}`
      const existing = await prisma.organization.findFirst({
        where: {
          OR: [
            { slug: altSlug },
            { emailPrefix: altSlug }
          ]
        }
      })
      
      if (!existing) {
        suggestions.push({
          name: `${organizationName} ${i}`,
          slug: altSlug,
          emailPrefix: altSlug,
          agentEmail: `${altSlug}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`
        })
      }
    }

    // Add creative alternatives
    const creativeOptions = [
      `${organizationName} Inc`,
      `${organizationName} Co`,
      `${organizationName} Ltd`,
      `${organizationName} Team`,
      `${organizationName} Group`
    ]

    for (const creative of creativeOptions) {
      if (suggestions.length >= 5) break
      
      const creativeSlug = slugify(creative)
      const existing = await prisma.organization.findFirst({
        where: {
          OR: [
            { slug: creativeSlug },
            { emailPrefix: creativeSlug }
          ]
        }
      })
      
      if (!existing) {
        suggestions.push({
          name: creative,
          slug: creativeSlug,
          emailPrefix: creativeSlug,
          agentEmail: `${creativeSlug}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`
        })
      }
    }

    return NextResponse.json({
      available: false,
      existing: {
        name: existingOrg.name,
        agentEmail: `${existingOrg.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`
      },
      suggestions: suggestions.slice(0, 4), // Limit to 4 suggestions
      message: "This organization name is already taken"
    })

  } catch (error) {
    console.error("Organization check error:", error)
    return NextResponse.json(
      { error: "Failed to check organization availability" },
      { status: 500 }
    )
  }
}
