'use client'

import { useState, useEffect } from 'react'
import { X, Mail, MessageSquare, Bell } from 'lucide-react'

export function WelcomeCard({ organizationEmail }: { organizationEmail: string }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user has dismissed the welcome
    const dismissed = localStorage.getItem('welcome-dismissed')
    if (!dismissed) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('welcome-dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <div className="mb-8 rounded-lg border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-medium">Welcome to Everling</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your AI-powered task manager that works via email
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* What it does */}
        <div className="text-xs text-muted-foreground">
          Everling turns emails into organized tasks with AI. Forward any email, and we'll extract deadlines, 
          assignees, and priorities automatically. No apps to download, no complex workflows.
        </div>

        {/* Three ways to use */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-foreground">Three ways to create tasks:</div>
          
          {/* Email */}
          <div className="flex items-start gap-3">
            <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-medium">Email (Primary)</div>
              <div className="text-xs text-muted-foreground">
                Send or forward to <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">{organizationEmail}</code>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Works from any device, any email client
              </div>
            </div>
          </div>
          
          {/* Quick Command */}
          <div className="flex items-start gap-3">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-medium">Natural Language</div>
              <div className="text-xs text-muted-foreground">
                Type in the box above: "Meeting with John tomorrow at 3pm"
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                AI understands dates, people, and priorities
              </div>
            </div>
          </div>
          
          {/* Reminders */}
          <div className="flex items-start gap-3">
            <Bell className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-medium">Smart Reminders</div>
              <div className="text-xs text-muted-foreground">
                Get notified via email or SMS when tasks are due
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Reply "done" to complete, "1h" to snooze
              </div>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Messaging integrations:</span>{' '}
            Connect Discord or Slack to create tasks directly from your team chat. 
            Just DM the bot or use slash commands. Set up in Settings → Integrations.
          </div>
        </div>

        {/* Quick start */}
        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Try it now:</span> Type "Schedule dentist appointment next week" in the box above and press Enter
          </div>
        </div>
      </div>
    </div>
  )
}
