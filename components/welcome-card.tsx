'use client'

import { useState, useEffect } from 'react'
import { X, Mail, MessageSquare, Calendar, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function WelcomeCard({ organizationEmail }: { organizationEmail: string }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    // Check if user has dismissed the welcome card
    const dismissed = localStorage.getItem('welcome-dismissed')
    const minimized = localStorage.getItem('welcome-minimized')
    
    if (!dismissed) {
      setIsVisible(true)
      setIsMinimized(minimized === 'true')
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('welcome-dismissed', 'true')
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
    localStorage.setItem('welcome-minimized', (!isMinimized).toString())
  }

  if (!isVisible) return null

  if (isMinimized) {
    return (
      <Card 
        className="mb-6 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={handleMinimize}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Quick Start Guide</span>
          </div>
          <span className="text-xs text-gray-500">Click to expand</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Welcome to Everling!
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Here's how to create tasks in 10 seconds:
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMinimize}
            className="text-gray-400 hover:text-gray-600 text-xs underline"
          >
            Minimize
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Email Method - PRIMARY */}
        <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-blue-200">
          <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-sm text-gray-900">
              📧 Email Tasks (Fastest)
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Send any email to <code className="bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-mono text-xs">{organizationEmail}</code>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Subject becomes task title, body becomes description. That's it!
            </div>
          </div>
        </div>

        {/* Other Methods - SECONDARY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 bg-white/70 rounded-lg p-3">
            <MessageSquare className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs text-gray-800">
                💬 Quick Command
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                Type in the box above or press <kbd className="px-1 py-0.5 text-xs bg-gray-100 rounded">Cmd+K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-white/70 rounded-lg p-3">
            <Calendar className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs text-gray-800">
                🔔 Smart Reminders
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                Set deadlines and get notified via email/SMS
              </div>
            </div>
          </div>
        </div>

        {/* Pro Tips */}
        <div className="bg-white/50 rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-600">
            <span className="font-medium text-gray-700">💡 Pro Tips:</span>
            <ul className="mt-1 space-y-0.5 ml-4">
              <li>• Forward any email to create a task instantly</li>
              <li>• Reply "done" to any reminder to complete the task</li>
              <li>• Add team members in Settings → Allowed Emails</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  )
}
