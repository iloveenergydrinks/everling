import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { Mail, MessageSquare, Search, Zap } from "lucide-react"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-3xl px-6">
        {/* Minimal Header */}
        <div className="mb-16 text-center">
          <h1 className="text-2xl font-medium mb-2">TaskManager</h1>
          <p className="text-sm text-muted-foreground">
            The most frictionless way to manage tasks
          </p>
        </div>

        {/* Hero Section - Minimal */}
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-light mb-6 tracking-tight">
            One search box.<br />
            Infinite possibilities.
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Forward emails to create tasks. Get daily digests. 
            Search with natural language. Everything just works.
          </p>
        </div>

        {/* Demo Search Bar */}
        <div className="mb-16">
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="urgent tasks from john..."
              disabled
              className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background/50 text-center"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            AI-powered search understands natural language
          </p>
        </div>

        {/* Three Key Features */}
        <div className="mb-16 grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-2">Email to Task</h3>
            <p className="text-sm text-muted-foreground">
              Forward any email to your unique address. AI extracts actionable tasks automatically.
            </p>
          </div>
          
          <div className="text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-2">Daily Digest</h3>
            <p className="text-sm text-muted-foreground">
              Get your tasks delivered via email or SMS every morning. Reply to complete.
            </p>
          </div>
          
          <div className="text-center">
            <Zap className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-2">Smart Ordering</h3>
            <p className="text-sm text-muted-foreground">
              Tasks auto-organize by relevance, urgency, and your interaction patterns.
            </p>
          </div>
        </div>

        {/* Simple Flow */}
        <div className="mb-16 p-6 border rounded-lg bg-muted/30">
          <h3 className="font-medium mb-4 text-center">How it works</h3>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>Forward email</span>
            <span>→</span>
            <span>AI creates task</span>
            <span>→</span>
            <span>Get daily digest</span>
            <span>→</span>
            <span>Reply to complete</span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link 
            href="/register"
            className="inline-block px-6 py-2 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
          >
            Get Started
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Free to try • No credit card required
          </p>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t text-center">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Login
            </Link>
            <span>•</span>
            <span>© 2025 TaskManager</span>
          </div>
        </div>
      </div>
    </div>
  )
}
