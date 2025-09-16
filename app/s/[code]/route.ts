import { NextRequest, NextResponse } from 'next/server'
import { getOriginalUrl } from '@/lib/url-shortener'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params
    
    if (!code) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Get the original URL
    const originalUrl = await getOriginalUrl(code)
    
    if (!originalUrl) {
      // Link expired or not found
      return NextResponse.redirect(new URL('/login?error=LinkExpired', request.url))
    }
    
    // Redirect to the original URL
    return NextResponse.redirect(originalUrl)
  } catch (error) {
    console.error('Short link redirect error:', error)
    return NextResponse.redirect(new URL('/login?error=InvalidLink', request.url))
  }
}
