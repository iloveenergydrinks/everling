'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, Globe } from 'lucide-react'

interface TimezoneIndicatorProps {
  selectedTimezone: string
  onTimezoneSync?: () => void
}

export function TimezoneIndicator({ selectedTimezone, onTimezoneSync }: TimezoneIndicatorProps) {
  const [browserTimezone, setBrowserTimezone] = useState<string>('')
  const [currentTimeSelected, setCurrentTimeSelected] = useState<string>('')
  const [currentTimeBrowser, setCurrentTimeBrowser] = useState<string>('')
  const [timezoneMismatch, setTimezoneMismatch] = useState(false)
  const [timeDifference, setTimeDifference] = useState<string>('')

  useEffect(() => {
    // Get browser timezone
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setBrowserTimezone(browserTz)
    
    // Check for mismatch
    const mismatch = browserTz !== selectedTimezone
    setTimezoneMismatch(mismatch)
    
    // Update times every second
    const updateTimes = () => {
      const now = new Date()
      
      // Format time in selected timezone
      const selectedTime = now.toLocaleTimeString('en-US', {
        timeZone: selectedTimezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
      setCurrentTimeSelected(selectedTime)
      
      // Format time in browser timezone
      const browserTime = now.toLocaleTimeString('en-US', {
        timeZone: browserTz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
      setCurrentTimeBrowser(browserTime)
      
      // Calculate time difference
      if (mismatch) {
        const selectedOffset = getTimezoneOffset(selectedTimezone)
        const browserOffset = getTimezoneOffset(browserTz)
        const diff = Math.abs(selectedOffset - browserOffset)
        const hours = Math.floor(diff / 60)
        const minutes = diff % 60
        
        if (hours > 0) {
          setTimeDifference(
            `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''} ${
              selectedOffset > browserOffset ? 'ahead' : 'behind'
            }`
          )
        } else {
          setTimeDifference('')
        }
      }
    }
    
    updateTimes()
    const interval = setInterval(updateTimes, 1000)
    
    return () => clearInterval(interval)
  }, [selectedTimezone])
  
  // Helper function to get timezone offset in minutes
  const getTimezoneOffset = (timezone: string): number => {
    const now = new Date()
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60)
  }
  
  const formatDate = (timezone: string) => {
    return new Date().toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-3">
      {/* Current time in selected timezone */}
      <div className="bg-muted/50 rounded-md p-4 border">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Your Selected Timezone</p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedTimezone.replace('_', ' ')}
            </p>
            <div className="mt-2">
              <p className="text-2xl font-bold tabular-nums">
                {currentTimeSelected}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(selectedTimezone)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timezone mismatch warning */}
      {timezoneMismatch && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Timezone Mismatch Detected
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Your browser is in <strong>{browserTimezone.replace('_', ' ')}</strong>
              </p>
              {timeDifference && (
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Your selected timezone is <strong>{timeDifference}</strong> your browser
                </p>
              )}
              
              {/* Browser time display */}
              <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">
                      Browser Time
                    </p>
                    <p className="text-sm font-bold tabular-nums text-yellow-900 dark:text-yellow-100">
                      {currentTimeBrowser}
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-3">
                <strong>⚠️ Important:</strong> When you create tasks "for today" or set deadlines, 
                they will use <strong>your selected timezone ({selectedTimezone.split('/').pop()?.replace('_', ' ')})</strong>, 
                not your browser's time.
              </p>
              
              {onTimezoneSync && (
                <button
                  onClick={onTimezoneSync}
                  className="mt-3 text-xs font-medium text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                >
                  Use browser timezone instead
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
