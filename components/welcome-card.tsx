'use client'

import { useState, useEffect } from 'react'
import { Mail, MessageSquare, Bell } from 'lucide-react'

export function WelcomeCard({ organizationEmail }: { organizationEmail: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user has dismissed the welcome via API (database only)
    const checkDismissalStatus = async () => {
      try {
        const response = await fetch('/api/user/welcome-dismiss')
        if (response.ok) {
          const data = await response.json()
          if (!data.dismissed) {
            setIsVisible(true)
          }
        } else {
          // Show welcome if API fails (better to show than hide)
          setIsVisible(true)
        }
      } catch (error) {
        console.error('Error checking welcome status:', error)
        // Show welcome if there's an error (better to show than hide)
        setIsVisible(true)
      } finally {
        setLoading(false)
      }
    }
    
    checkDismissalStatus()
  }, [])

  const handleDismiss = async () => {
    setIsVisible(false)
    
    // Save to database
    try {
      await fetch('/api/user/welcome-dismiss', { method: 'POST' })
    } catch (error) {
      console.error('Error saving welcome dismissal:', error)
      // If save fails, show it again on next load
      setIsVisible(true)
    }
  }

  if (loading || !isVisible) return null

  return (
    <div className="mb-6 rounded-lg border bg-background">
      <div className="p-4 space-y-3">
        {/* Header with clear value prop */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium">Welcome to Everling</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI turns your emails into organized tasks automatically
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-xs px-2 py-1 rounded-sm bg-foreground text-background hover:bg-foreground/90 transition-colors"
            aria-label="Dismiss"
          >
            Got it
          </button>
        </div>
        
        {/* What it does - one line */}
        <div className="text-xs text-muted-foreground pb-2 border-b">
          Forward any email and we'll extract deadlines, assignees, and priorities. No app needed.
        </div>
        
        {/* Three methods - compact but clear */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs">
                <span className="font-medium">Email</span> → <code className="text-[10px] px-1 py-0.5 rounded bg-muted">{organizationEmail}</code>
              </div>
              <div className="text-xs text-muted-foreground">Forward from Gmail, Outlook, anywhere</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs">
                <span className="font-medium">Quick add</span> → Search box above
              </div>
              <div className="text-xs text-muted-foreground">"Meeting tomorrow 3pm" - AI understands</div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Bell className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs">
                <span className="font-medium">Smart reminders</span> → Email/SMS/Discord
              </div>
              <div className="text-xs text-muted-foreground">Reply "done" to complete tasks</div>
            </div>
          </div>
        </div>
        
        {/* Clear CTA */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Try now:</span> Type "Schedule dentist next week" in the box above
          </div>
        </div>
      </div>
    </div>
  )
}
