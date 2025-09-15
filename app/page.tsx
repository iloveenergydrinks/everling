import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-2xl font-bold">
            TaskManager
          </Link>
          <nav className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Turn Emails into Tasks
            <span className="text-primary"> Automatically</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Forward any email to your unique address and let AI extract actionable tasks. 
            No more manual copying, no more forgotten follow-ups.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline">
                See How It Works
              </Button>
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="border-t bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">
              How It Works
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                    1
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Forward Email</h3>
                <p className="text-muted-foreground">
                  Send or forward any email to your unique TaskManager address
                </p>
              </div>
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                    2
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">AI Processes</h3>
                <p className="text-muted-foreground">
                  Claude AI extracts task details, priorities, and due dates
                </p>
              </div>
              <div className="text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
                    3
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">Task Created</h3>
                <p className="text-muted-foreground">
                  View and manage your tasks in a beautiful dashboard
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-12 text-3xl font-bold">Features</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border p-6">
                <h3 className="mb-2 text-xl font-semibold">Multi-tenant</h3>
                <p className="text-muted-foreground">
                  Each organization gets their own email address and workspace
                </p>
              </div>
              <div className="rounded-lg border p-6">
                <h3 className="mb-2 text-xl font-semibold">Smart Extraction</h3>
                <p className="text-muted-foreground">
                  AI understands context and extracts relevant task information
                </p>
              </div>
              <div className="rounded-lg border p-6">
                <h3 className="mb-2 text-xl font-semibold">Team Collaboration</h3>
                <p className="text-muted-foreground">
                  Invite team members and assign tasks automatically
                </p>
              </div>
              <div className="rounded-lg border p-6">
                <h3 className="mb-2 text-xl font-semibold">Integrations</h3>
                <p className="text-muted-foreground">
                  Connect with Trello, Notion, Linear, and more (coming soon)
                </p>
              </div>
              <div className="rounded-lg border p-6">
                <h3 className="mb-2 text-xl font-semibold">API Access</h3>
                <p className="text-muted-foreground">
                  Full API access to integrate with your existing tools
                </p>
              </div>
              <div className="rounded-lg border p-6">
                <h3 className="mb-2 text-xl font-semibold">Activity Log</h3>
                <p className="text-muted-foreground">
                  Track all emails processed and tasks created
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2025 TaskManager. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
