"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Tasks", href: "/dashboard/tasks" },
  { name: "Emails", href: "/dashboard/emails" },
  { name: "Settings", href: "/dashboard/settings" },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="flex h-screen w-56 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/dashboard" className="text-lg font-medium">
          TaskManager
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground mb-3">
          {session?.user?.organizationSlug}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}