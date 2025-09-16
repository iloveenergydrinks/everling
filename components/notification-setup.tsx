"use client"

import { useState, useEffect } from "react"
import { timezones, getTimeOptions, getUserTimezone } from "@/lib/timezones"
import { countries, getDefaultCountry, formatPhoneNumber } from "@/lib/countries"
import { ChevronDown, X, Mail, MessageSquare, Ban, Zap } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface NotificationSetupProps {
  onComplete?: () => void
  isOnboarding?: boolean
}

export function NotificationSetup({ onComplete, isOnboarding = false }: NotificationSetupProps) {
  const [notificationType, setNotificationType] = useState("email")
  const [digestTime, setDigestTime] = useState("08:00")
  const [timezone, setTimezone] = useState(getUserTimezone())
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountry())
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPreferences, setLoadingPreferences] = useState(true)

  // Load current preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/user/preferences')
        if (response.ok) {
          const data = await response.json()
          setNotificationType(data.notificationType || 'email')
          setDigestTime(data.digestTime || '08:00')
          setTimezone(data.timezone || getUserTimezone())
          
          // Load SMS settings if available
          if (data.phoneNumber) {
            const fullNumber = data.phoneNumber
            const country = countries.find(c => fullNumber.startsWith(c.dialCode))
            if (country) {
              setSelectedCountry(country.code)
              const numberWithoutCode = fullNumber.replace(country.dialCode, '')
              setWhatsappPhone(numberWithoutCode)
            }
          }
        }
      } catch (error) {
        console.error('Failed to load preferences:', error)
      } finally {
        setLoadingPreferences(false)
      }
    }

    loadPreferences()
  }, [])

  const handleSave = async () => {
    setLoading(true)
    
    try {
      // Save notification preferences
      const preferencesResponse = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationType,
          digestTime,
          timezone,
          emailDigestEnabled: notificationType === 'email' || notificationType === 'both',
          smsDigestEnabled: notificationType === 'sms' || notificationType === 'both'
        })
      })

      if (!preferencesResponse.ok) {
        throw new Error('Failed to save preferences')
      }

      // If SMS is selected, set up phone number
      if ((notificationType === 'sms' || notificationType === 'both') && whatsappPhone) {
        const fullPhoneNumber = formatPhoneNumber(selectedCountry, whatsappPhone)
        
        const smsResponse = await fetch('/api/user/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phoneNumber: fullPhoneNumber,
            action: 'enable'
          })
        })

        if (!smsResponse.ok) {
          throw new Error('Failed to set up SMS')
        }
      }

      toast({
        title: "Success!",
        description: "Your notification preferences have been saved",
        variant: "success"
      })

      onComplete?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  const requiresPhone = notificationType === 'sms' || notificationType === 'both'

  // Show loading while preferences are being fetched
  if (loadingPreferences) {
    return (
      <div className={`border rounded-md p-6 bg-white shadow-sm ${isOnboarding ? 'border-blue-200 bg-blue-50/50' : ''}`}>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Loading preferences...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-md p-6 bg-white shadow-sm ${isOnboarding ? 'border-blue-200 bg-blue-50/50' : ''}`}>
      {isOnboarding && (
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Set up your daily digest
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Get your tasks delivered the way you prefer, when you prefer.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Notification Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            How would you like to receive your daily digest?
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setNotificationType('email')}
              className={`p-3 border rounded text-left transition-all ${
                notificationType === 'email' 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-input hover:bg-muted'
              }`}
            >
              <div className="font-medium flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div className="text-xs text-muted-foreground mt-1">Clean, detailed digest</div>
            </button>
            
            <button
              onClick={() => setNotificationType('sms')}
              className={`p-3 border rounded text-left transition-all ${
                notificationType === 'sms' 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-input hover:bg-muted'
              }`}
            >
              <div className="font-medium flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                SMS
              </div>
              <div className="text-xs text-muted-foreground mt-1">Quick, instant alerts</div>
            </button>
            
            <button
              onClick={() => setNotificationType('both')}
              className={`p-3 border rounded text-left transition-all ${
                notificationType === 'both' 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-input hover:bg-muted'
              }`}
            >
              <div className="font-medium flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <MessageSquare className="h-4 w-4" />
                Both
              </div>
              <div className="text-xs text-muted-foreground mt-1">Never miss anything</div>
            </button>
            
            <button
              onClick={() => setNotificationType('none')}
              className={`p-3 border rounded text-left transition-all ${
                notificationType === 'none' 
                  ? 'border-muted-foreground bg-muted text-muted-foreground' 
                  : 'border-input hover:bg-muted'
              }`}
            >
              <div className="font-medium flex items-center gap-2 text-sm">
                <Ban className="h-4 w-4" />
                None
              </div>
              <div className="text-xs text-muted-foreground mt-1">Manual check only</div>
            </button>
          </div>
        </div>

        {/* Time and Timezone - only show if not 'none' */}
        {notificationType !== 'none' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                What time?
              </label>
              <select 
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {getTimeOptions().map(time => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Your timezone
              </label>
              <select 
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {timezones.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map(tz => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Phone Number - only show if SMS is selected */}
        {requiresPhone && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Your phone number for SMS
            </label>
            <div className="flex gap-2">
              {/* Country Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm border rounded bg-background hover:bg-muted"
                >
                  <span className="text-sm font-medium">
                    {countries.find(c => c.code === selectedCountry)?.code}
                  </span>
                  <span className="text-sm">
                    {countries.find(c => c.code === selectedCountry)?.dialCode}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                
                {showCountryDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowCountryDropdown(false)}
                    />
                    <div className="absolute top-full mt-1 left-0 w-64 max-h-64 overflow-y-auto bg-background border rounded shadow-lg z-50">
                      {countries.map((country) => (
                        <button
                          key={country.code}
                          onClick={() => {
                            setSelectedCountry(country.code)
                            setShowCountryDropdown(false)
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-left"
                        >
                          <span className="text-sm font-medium w-8">{country.code}</span>
                          <span className="text-sm flex-1">{country.name}</span>
                          <span className="text-sm text-muted-foreground">{country.dialCode}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {/* Phone Number Input */}
              <input
                type="tel"
                placeholder="234567890"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, ''))}
                className="flex-1 px-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Preview */}
        {notificationType !== 'none' && (
          <div className="bg-muted rounded p-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {notificationType === 'email' && <Mail className="h-4 w-4" />}
              {notificationType === 'sms' && <MessageSquare className="h-4 w-4" />}
              {notificationType === 'both' && (
                <>
                  <Mail className="h-4 w-4" />
                  <MessageSquare className="h-4 w-4" />
                </>
              )}
              <strong>You'll receive your daily digest</strong> at{' '}
              <span className="font-medium">
                {digestTime.replace(/(\d{2}):(\d{2})/, (_, h, m) => {
                  const hour = parseInt(h)
                  const period = hour >= 12 ? 'PM' : 'AM'
                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                  return `${displayHour}:${m} ${period}`
                })}
              </span>{' '}
              via{' '}
              <span className="font-medium">
                {notificationType === 'both' ? 'Email & SMS' : 
                 notificationType === 'email' ? 'Email' : 'SMS'}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSave}
            disabled={loading || (requiresPhone && !whatsappPhone)}
            className="w-full px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Saving...' : isOnboarding ? 'Get Started' : 'Save Preferences'}
          </button>
          
          {/* Manual Send Digest Button - Always show in drawer */}
          {!isOnboarding && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/cron/daily-digest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  })
                  
                  if (response.ok) {
                    const data = await response.json()
                    toast({
                      title: "Digest Sent!",
                      description: data.mock 
                        ? "Test digest simulated (check console)" 
                        : "Check your email/phone for today's digest",
                      variant: "success"
                    })
                  } else {
                    toast({
                      title: "Error",
                      description: "Failed to send digest. Make sure your preferences are saved first.",
                      variant: "error"
                    })
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to send digest",
                    variant: "error"
                  })
                }
              }}
              disabled={notificationType === 'none'}
              className="w-full px-3 py-1.5 text-sm border rounded hover:bg-muted font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4" />
              {notificationType === 'none' ? 'Configure notifications first' : 'Send Today\'s Digest Now'}
            </button>
          )}
          
          {isOnboarding && (
            <button
              onClick={onComplete}
              className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
