"use client"

import { useState, useEffect } from "react"
import { NotificationSetup } from "@/components/notification-setup"
import { Bell, Check, Clock, Mail, MessageSquare } from "lucide-react"

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/user/preferences')
      if (response.ok) {
        const data = await response.json()
        setPreferences(data)
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notification Preferences</h1>
              <p className="text-sm text-muted-foreground">
                Choose how and when you want to receive your daily task digest
              </p>
            </div>
          </div>
        </div>

        {/* Current Status */}
        {preferences && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              Current Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {preferences.notificationType === 'email' && <Mail className="h-4 w-4 text-blue-600" />}
                {preferences.notificationType === 'sms' && <MessageSquare className="h-4 w-4 text-green-600" />}
                {preferences.notificationType === 'both' && (
                  <>
                    <Mail className="h-4 w-4 text-blue-600" />
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </>
                )}
                {preferences.notificationType === 'none' && <span className="text-gray-500">No notifications</span>}
                <span className="capitalize">
                  {preferences.notificationType === 'both' ? 'Email & SMS' : preferences.notificationType}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>
                  {preferences.digestTime?.replace(/(\d{2}):(\d{2})/, (_, h, m) => {
                    const hour = parseInt(h)
                    const period = hour >= 12 ? 'PM' : 'AM'
                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                    return `${displayHour}:${m} ${period}`
                  }) || '8:00 AM'}
                </span>
              </div>
              
              <div className="text-xs text-gray-500">
                {preferences.timezone?.replace(/_/g, ' ') || 'America/New York'}
              </div>
            </div>
          </div>
        )}

        {/* Notification Setup Form */}
        <NotificationSetup 
          onComplete={() => {
            fetchPreferences() // Refresh after save
          }}
        />

        {/* Help Section */}
        <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium mb-3 text-blue-900">📚 How Daily Digests Work</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium text-blue-900 mt-0.5">1</div>
              <div>
                <strong>Every morning</strong> at your chosen time, we'll send you a digest with all tasks scheduled for that day.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium text-blue-900 mt-0.5">2</div>
              <div>
                <strong>Email digests</strong> include a beautiful overview with task details and direct links to your dashboard.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium text-blue-900 mt-0.5">3</div>
              <div>
                <strong>SMS digests</strong> are concise and actionable - reply with a number (1-5) to mark tasks complete instantly.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium text-blue-900 mt-0.5">4</div>
              <div>
                <strong>No tasks today?</strong> We'll still send a friendly "enjoy your day" message so you know the system is working.
              </div>
            </div>
          </div>
        </div>

        {/* Test Section */}
        <div className="mt-6 p-4 border rounded-lg">
          <h3 className="font-medium mb-3">🧪 Test Your Setup</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Want to see how your digest will look? Send yourself a test message right now.
          </p>
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/cron/daily-digest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                })
                
                if (response.ok) {
                  alert('Test digest sent! Check your email/phone.')
                } else {
                  alert('Failed to send test. Make sure your preferences are saved.')
                }
              } catch (error) {
                alert('Failed to send test digest.')
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Send Test Digest Now
          </button>
        </div>
      </div>
    </div>
  )
}
