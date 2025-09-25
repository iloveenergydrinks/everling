"use client"

import { useState, useEffect } from "react"
import { timezones, getTimeOptions, getUserTimezone } from "@/lib/timezones"
import { countries, getDefaultCountry, formatPhoneNumber } from "@/lib/countries"
import { ChevronDown, X, Mail, MessageSquare, Ban, Zap } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { TimezoneIndicator } from "@/components/timezone-indicator"

// Discord Logo SVG Component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
  </svg>
)

interface NotificationSetupProps {
  onComplete?: () => void
  isOnboarding?: boolean
  timezone?: string
  onTimezoneChange?: (tz: string) => void
}

export function NotificationSetup({ 
  onComplete, 
  isOnboarding = false,
  timezone: propTimezone,
  onTimezoneChange 
}: NotificationSetupProps) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [digestTime, setDigestTime] = useState("08:00")
  const [timezone, setTimezone] = useState<string>(propTimezone || 'America/New_York')
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountry())
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPreferences, setLoadingPreferences] = useState(true)
  const [discordConnected, setDiscordConnected] = useState(false)
  const [discordDMError, setDiscordDMError] = useState<string | null>(null)

  // Sync with prop timezone when it changes
  useEffect(() => {
    if (propTimezone && propTimezone !== timezone) {
      setTimezone(propTimezone)
    }
  }, [propTimezone])

  // Load current preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/user/preferences')
        if (response.ok) {
          const data = await response.json()
          // Load Discord settings first
          setDiscordConnected(data.discordConnected || false)
          setDiscordDMError(data.discordDMError || null)
          
          // Build selected channels array based on preferences
          const channels = []
          if (data.emailDigestEnabled || data.notificationType === 'email' || data.notificationType === 'both') {
            channels.push('email')
          }
          if (data.smsDigestEnabled || data.notificationType === 'sms' || data.notificationType === 'both') {
            channels.push('sms')
          }
          if (data.discordConnected && data.discordDigestEnabled) {
            channels.push('discord')
          }
          
          // If no channels are selected, default to email
          if (channels.length === 0 && data.notificationType !== 'none') {
            channels.push('email')
          }
          
          setSelectedChannels(channels)
          setDigestTime(data.digestTime || '08:00')
          
          // Load timezone from database, fallback to browser timezone if not set
          if (data.timezone) {
            setTimezone(data.timezone)
          } else {
            // If no timezone from DB, use browser timezone as fallback
            const browserTz = getUserTimezone()
            setTimezone(browserTz)
          }
          
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

  const toggleChannel = (channel: string) => {
    setSelectedChannels(prev => {
      if (prev.includes(channel)) {
        // Remove channel
        return prev.filter(c => c !== channel)
      } else {
        // Add channel
        return [...prev, channel]
      }
    })
  }

  const handleSave = async () => {
    setLoading(true)
    
    try {
      // Save notification preferences
      const hasEmail = selectedChannels.includes('email')
      const hasSms = selectedChannels.includes('sms')
      const hasDiscord = selectedChannels.includes('discord')
      
      // Determine notificationType for backwards compatibility
      let notificationType = 'none'
      if (hasEmail && hasSms && !hasDiscord) {
        notificationType = 'both'
      } else if (hasEmail && !hasSms) {
        notificationType = 'email'
      } else if (hasSms && !hasEmail) {
        notificationType = 'sms'
      }
      
      const preferencesResponse = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationType,
          digestTime,
          timezone,
          emailDigestEnabled: hasEmail,
          smsDigestEnabled: hasSms,
          discordDigestEnabled: hasDiscord
        })
      })

      if (!preferencesResponse.ok) {
        throw new Error('Failed to save preferences')
      }

      // If SMS is selected, set up phone number
      if (selectedChannels.includes('sms') && whatsappPhone) {
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

  const requiresPhone = selectedChannels.includes('sms')

  // Show loading while preferences are being fetched
  if (loadingPreferences) {
    const loadingClassName = isOnboarding 
      ? "border rounded-md p-6 bg-background shadow-sm border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
      : "border rounded-md p-6 bg-background shadow-sm"
    
    return (
      <div className={loadingClassName}>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Loading preferences...</p>
        </div>
      </div>
    )
  }

  const mainClassName = isOnboarding 
    ? "border rounded-md p-6 bg-background shadow-sm border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
    : "border rounded-md p-6 bg-background shadow-sm"
  
  return (
    <div className={mainClassName}>
      {isOnboarding && (
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Set up your daily digest
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Get your tasks delivered the way you prefer, when you prefer.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Notification Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Select notification channels (you can choose multiple)
          </label>
          <div className={`grid gap-3 ${discordConnected ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
            <button
              onClick={() => toggleChannel('email')}
              className={`p-3 border-2 rounded text-left transition-all relative ${
                selectedChannels.includes('email') 
                  ? 'border-primary bg-primary/5' 
                  : 'border-input hover:bg-muted'
              }`}
            >
              {selectedChannels.includes('email') && (
                <svg className="absolute top-2 right-2 w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <div className="font-medium flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                Email
              </div>
              <div className="text-xs text-muted-foreground mt-1">Clean, detailed digest</div>
            </button>
            
            <button
              onClick={() => toggleChannel('sms')}
              className={`p-3 border-2 rounded text-left transition-all relative ${
                selectedChannels.includes('sms')
                  ? 'border-primary bg-primary/5' 
                  : 'border-input hover:bg-muted'
              }`}
            >
              {selectedChannels.includes('sms') && (
                <svg className="absolute top-2 right-2 w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <div className="font-medium flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                SMS
              </div>
              <div className="text-xs text-muted-foreground mt-1">Quick, instant alerts</div>
            </button>
            
            {discordConnected && (
              <button
                onClick={() => toggleChannel('discord')}
                className={`p-3 border-2 rounded text-left transition-all relative ${
                  selectedChannels.includes('discord')
                    ? 'border-primary bg-primary/5' 
                    : 'border-input hover:bg-muted'
                }`}
              >
                {selectedChannels.includes('discord') && (
                  <svg className="absolute top-2 right-2 w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <div className="font-medium flex items-center gap-2 text-sm">
                  <DiscordIcon className="h-4 w-4 text-[#5865F2]" />
                  Discord
                </div>
                <div className="text-xs text-muted-foreground mt-1">Private DMs</div>
              </button>
            )}
          </div>
          
          {/* Discord connection hint */}
          {!discordConnected && (
            <p className="text-xs text-muted-foreground mt-3">
              💡 Connect Discord in the Integrations settings to enable Discord notifications
            </p>
          )}
        </div>

        {/* Time and Timezone - only show if channels are selected */}
        {selectedChannels.length > 0 && (
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
                onChange={(e) => {
                  const newTimezone = e.target.value
                  if (onTimezoneChange) {
                    onTimezoneChange(newTimezone)
                  } else {
                    setTimezone(newTimezone)
                  }
                }}
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
        
        {/* Timezone indicator and warning */}
        {selectedChannels.length > 0 && (
          <TimezoneIndicator 
            selectedTimezone={timezone}
            onTimezoneSync={async () => {
              const browserTz = getUserTimezone()
              
              // If parent component provided handler, use it
              if (onTimezoneChange) {
                onTimezoneChange(browserTz)
              } else {
                // Otherwise handle locally
                setTimezone(browserTz)
                
                // Only update timezone in database, not other preferences
                try {
                  const response = await fetch('/api/user/timezone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      timezone: browserTz
                    })
                  })
                  
                  if (response.ok) {
                    toast({
                    title: "Timezone Updated",
                    description: `Switched to your browser timezone: ${browserTz}`,
                    variant: "success"
                  })
                  } else {
                    throw new Error('Failed to update timezone')
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to update timezone. Please try again.",
                    variant: "error"
                  })
                }
              }
            }}
          />
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

        {/* Discord Setup Instructions */}
        {selectedChannels.includes('discord') && (
          <div className={`border rounded p-3 text-sm ${
            discordDMError 
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
          }`}>
            <p className={`font-medium mb-1 ${
              discordDMError 
                ? 'text-red-900 dark:text-red-100' 
                : 'text-blue-900 dark:text-blue-100'
            }`}>
              {discordDMError ? '⚠️ Discord DMs Blocked' : '📌 Discord DM Setup'}
            </p>
            {discordDMError ? (
              <>
                <p className="text-red-700 dark:text-red-300 text-xs leading-relaxed">
                  We couldn't send you a Discord DM. To fix this:
                </p>
                <ol className="text-red-700 dark:text-red-300 text-xs mt-2 space-y-1 list-decimal list-inside">
                  <li>Go to the Discord server where the bot is</li>
                  <li>Right-click the server → Privacy Settings</li>
                  <li>Enable "Allow direct messages from server members"</li>
                  <li>Try sending "Send Today's Digest Now" again to test</li>
                </ol>
              </>
            ) : (
              <>
                <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
                  Discord digests are sent privately via DM:
                </p>
                <ol className="text-blue-700 dark:text-blue-300 text-xs mt-2 space-y-1 list-decimal list-inside">
                  <li>The bot must share at least one server with you</li>
                  <li>Enable "Allow direct messages from server members" in Discord privacy settings</li>
                  <li>Digests will be sent privately - only you can see them</li>
                </ol>
                <p className="text-blue-600 dark:text-blue-400 text-xs mt-2">
                  💡 Privacy: All Discord digests are DM-only for complete privacy
                </p>
              </>
            )}
          </div>
        )}

        {/* Preview */}
        {selectedChannels.length > 0 && (
          <div className="bg-muted rounded p-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {selectedChannels.includes('email') && <Mail className="h-4 w-4" />}
              {selectedChannels.includes('sms') && <MessageSquare className="h-4 w-4" />}
              {selectedChannels.includes('discord') && <DiscordIcon className="h-4 w-4 text-[#5865F2]" />}
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
                {selectedChannels.length === 1 
                  ? selectedChannels[0].charAt(0).toUpperCase() + selectedChannels[0].slice(1)
                  : selectedChannels.length === 2
                  ? `${selectedChannels[0].charAt(0).toUpperCase() + selectedChannels[0].slice(1)} and ${selectedChannels[1].charAt(0).toUpperCase() + selectedChannels[1].slice(1)}`
                  : `${selectedChannels.slice(0, -1).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}, and ${selectedChannels[selectedChannels.length - 1].charAt(0).toUpperCase() + selectedChannels[selectedChannels.length - 1].slice(1)}`}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSave}
            disabled={loading || (requiresPhone && !whatsappPhone) || selectedChannels.length === 0}
            className="w-full px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Saving...' : selectedChannels.length === 0 ? 'Select at least one channel' : isOnboarding ? 'Get Started' : 'Save Preferences'}
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
              disabled={selectedChannels.length === 0}
              className="w-full px-3 py-1.5 text-sm border rounded hover:bg-muted font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4" />
              {selectedChannels.length === 0 ? 'Select at least one channel' : 'Send Today\'s Digest Now'}
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
