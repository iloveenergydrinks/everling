'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface CompactTimezoneIndicatorProps {
  selectedTimezone?: string
  className?: string
}

export function CompactTimezoneIndicator({ 
  selectedTimezone = 'America/New_York', 
  className = '' 
}: CompactTimezoneIndicatorProps) {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [browserTimezone, setBrowserTimezone] = useState<string>('')
  const [mismatch, setMismatch] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Get browser timezone
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setBrowserTimezone(browserTz)
    
    // Check for mismatch
    const hasMismatch = browserTz !== selectedTimezone
    setMismatch(hasMismatch)
    
    // Update time every second
    const updateTime = () => {
      const now = new Date()
      const time = now.toLocaleTimeString('en-US', {
        timeZone: selectedTimezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      const date = now.toLocaleDateString('en-US', {
        timeZone: selectedTimezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
      setCurrentTime(time)
      setCurrentDate(date)
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [selectedTimezone])
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDetails(false)
      }
    }
    
    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDetails])
  
  const getTimezoneAbbr = (tz: string): string => {
    const parts = tz.split('/')
    return parts[parts.length - 1].replace('_', ' ')
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="group flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {mismatch && (
          <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
        )}
        <span className="tabular-nums">{currentTime}</span>
        <span className="opacity-60">·</span>
        <span>{currentDate}</span>
        <span className="opacity-60">·</span>
        <span>{getTimezoneAbbr(selectedTimezone)}</span>
      </button>
      
      {/* Dropdown details */}
      {showDetails && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-background border rounded-lg shadow-lg p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Arrow pointing down */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-b border-r rotate-45"></div>
          
          <div className="space-y-2 relative">
            <div>
              <p className="text-xs text-muted-foreground">Your Profile Timezone</p>
              <p className="text-sm">{selectedTimezone.replace('_', ' ')}</p>
              <p className="text-lg font-bold tabular-nums">{currentTime}</p>
            </div>
            
            {mismatch && (
              <>
                <div className="border-t pt-2">
                  <p className="text-xs text-muted-foreground">Browser Timezone</p>
                  <p className="text-sm">{browserTimezone.replace('_', ' ')}</p>
                  <p className="text-sm tabular-nums">
                    {new Date().toLocaleTimeString('en-US', {
                      timeZone: browserTimezone,
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded p-2">
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    <strong>Note:</strong> Tasks use your profile timezone, not browser time.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
