'use client'

import { useState, useEffect } from 'react'
import { X, Mail, MessageSquare, Bell } from 'lucide-react'

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
    <div className="mb-6 rounded-lg border bg-muted/30">
      {/* Simplified compact design */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium">Getting Started</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Three ways to create tasks
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors -mt-1"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        
        {/* Simplified options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Email:</span>{' '}
              <code className="text-[10px]">{organizationEmail}</code>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Type:</span> Use the search box above
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Reminders:</span> Email/SMS alerts
            </div>
          </div>
        </div>
        
        {/* Single CTA */}
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium">Try:</span> "Meeting tomorrow at 3pm" ↑
        </div>
      </div>
    </div>
  )
}
