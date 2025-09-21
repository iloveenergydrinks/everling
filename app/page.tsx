import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import Image from "next/image"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen py-12">
        <div className="mx-auto max-w-3xl px-6">
        {/* Minimal Header with Login */}
        <div className="mb-16 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium">Everling.io</h1>
            <p className="text-sm text-muted-foreground">
              Know before it matters
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/register"
              className="px-4 py-2 text-sm bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
            >
              Sign up
            </Link>
            <Link 
              href="/login"
              className="px-4 py-2 text-sm border rounded hover:bg-muted transition-colors"
            >
              Login
            </Link>
          </div>
        </div>

        {/* Hero Section - Minimal */}
        <div className="mb-16 text-center">
          <div className="mb-6 flex items-center justify-center">
            <div className="relative">
              <Image src="/everling_logo.png" alt="Everling logo" width={80} height={80} className="animate-float-slow" />
              <div className="absolute left-0 right-0 top-[90px] mx-auto h-2 w-20 rounded-full bg-black/20 blur-[3px] animate-shadow-pulse"></div>
            </div>
          </div>
          <h2 className="text-4xl font-light mb-6 tracking-tight">
            Minimalism meets<br />
            intelligence.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            The most minimal task manager that learns what matters to you. 
            Know before it matters, act with zero friction.
          </p>
        </div>

        {/* Demo Search Bar */}
        <div className="mb-16">
          <div className="relative max-w-lg mx-auto">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <div className="w-full pl-10 pr-4 py-3 border rounded-md bg-background/50 text-center text-muted-foreground">
              Forward emails or messages. AI turns them into tasks.
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            No setup. Just forward → AI extracts tasks, reminders, and tags.
          </p>
        </div>

        {/* Core Philosophy */}
        <div className="mb-16 text-center">
          <h3 className="text-lg font-medium mb-6">Three principles. Zero compromise.</h3>
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="w-12 h-12 mx-auto mb-4 border rounded-md flex items-center justify-center">
                <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              <h4 className="font-medium mb-2">Minimal Interface</h4>
              <p className="text-sm text-muted-foreground">
                Just forward emails or messages. No labels, no lists to curate.
              </p>
            </div>
            
            <div>
              <div className="w-12 h-12 mx-auto mb-4 border rounded-md flex items-center justify-center">
                <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"></polygon>
                </svg>
              </div>
              <h4 className="font-medium mb-2">Know Before It Matters</h4>
              <p className="text-sm text-muted-foreground">
                AI learns your patterns and timing. The right tasks surface when you need them.
              </p>
            </div>
            
            <div>
              <div className="w-12 h-12 mx-auto mb-4 border rounded-md flex items-center justify-center">
                <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <h4 className="font-medium mb-2">Zero Friction</h4>
              <p className="text-sm text-muted-foreground">
                Forward → Morning digest → Reply to complete. Stay in your inbox.
              </p>
            </div>
          </div>
        </div>

        {/* The Promise */}
        <div className="mb-16 p-8 border rounded-md bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50">
          <div className="text-center">
            <h3 className="text-xl font-medium mb-4">Know before it matters</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your most important tasks surface exactly when you need them. 
              No overwhelming lists, no decision fatigue.
            </p>
            <div className="text-sm text-muted-foreground">
              Forward email → AI learns → Morning digest → One-tap complete
            </div>
          </div>
        </div>

        {/* Anti-Features (What we DON'T have) */}
        <div className="mb-16 p-6 border rounded-md">
          <h3 className="font-medium mb-4 text-center">What we removed</h3>
          <div className="grid gap-4 md:grid-cols-2 text-sm text-muted-foreground">
            <div className="text-center">
              <span className="line-through">Complex filters</span>
              <p className="text-xs mt-1">Just search naturally</p>
            </div>
            <div className="text-center">
              <span className="line-through">Endless notifications</span>
              <p className="text-xs mt-1">One daily digest</p>
            </div>
            <div className="text-center">
              <span className="line-through">Manual organization</span>
              <p className="text-xs mt-1">AI orders by relevance</p>
            </div>
            <div className="text-center">
              <span className="line-through">App switching</span>
              <p className="text-xs mt-1">Works in your email</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link 
            href="/register"
            className="inline-block px-8 py-3 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
          >
            Start with zero friction
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Free • No setup required • Works immediately
          </p>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-2">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2025 Everling.io • Built for minimalists
          </p>
        </div>
        </div>
    </div>
  )
}
