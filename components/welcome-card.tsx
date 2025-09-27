'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export function WelcomeCard({ organizationEmail }: { organizationEmail: string }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has dismissed the welcome tip
    const dismissed = localStorage.getItem('welcome-tip-dismissed')
    if (!dismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('welcome-tip-dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <div className="mb-6 p-4 rounded-lg border bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Quick tip</span>
            <span className="text-xs text-muted-foreground">
              Send any email to <code className="px-1.5 py-0.5 rounded bg-background font-mono text-xs">{organizationEmail}</code> to create a task
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Or use the search box above to add tasks with natural language • Press <kbd className="px-1 py-0.5 rounded border bg-background text-[10px]">Enter</kbd> to run
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
