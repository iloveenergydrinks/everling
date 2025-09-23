"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { formatDate, formatDateTime } from "@/lib/utils"
import { timezones } from "@/lib/timezones"
import { CheckCircle, Copy, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { showConfirm, showPrompt } from "@/components/global-modal"

interface SettingsDrawerProps {
  show: boolean
  onClose: () => void
  organization: any
  agentEmail: string
  timezone: string
  onTimezoneChange: (tz: string) => void
  timezoneLoading: boolean
  onShowNotifications: () => void
}

interface EmailLog {
  id: string
  fromEmail: string
  toEmail: string
  subject: string
  processed: boolean
  taskId: string | null
  error: string | null
  createdAt: string
  rawData: any
}

export function SettingsDrawer({
  show,
  onClose,
  organization,
  agentEmail,
  timezone,
  onTimezoneChange,
  timezoneLoading,
  onShowNotifications,
}: SettingsDrawerProps) {
  const { data: session } = useSession()
  const [allowedEmails, setAllowedEmails] = useState<any[]>([])
  const [loadingAllowedEmails, setLoadingAllowedEmails] = useState(false)
  const [showAddEmailForm, setShowAddEmailForm] = useState(false)
  const [newEmailAddress, setNewEmailAddress] = useState("")
  const [newEmailNote, setNewEmailNote] = useState("")
  const [copied, setCopied] = useState(false)
  const [copiedText, setCopiedText] = useState("")
  
  // Email logs state
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [selectedRawData, setSelectedRawData] = useState<any>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [showEmailLogsSection, setShowEmailLogsSection] = useState(false)

  // Fetch allowed emails when drawer opens
  useEffect(() => {
    if (show) {
      fetchAllowedEmails()
    }
  }, [show])
  
  // Fetch email logs when section is opened
  useEffect(() => {
    if (showEmailLogsSection) {
      fetchEmailLogs()
      // Set up polling
      const interval = setInterval(fetchEmailLogs, 3000)
      return () => clearInterval(interval)
    }
  }, [showEmailLogsSection])

  const fetchEmailLogs = async () => {
    setLoadingLogs(true)
    try {
      const response = await fetch("/api/emails")
      if (response.ok) {
        const data = await response.json()
        setEmailLogs(data)
      }
    } catch (error) {
      console.error("Error fetching email logs:", error)
    } finally {
      setLoadingLogs(false)
    }
  }

  const fetchAllowedEmails = async () => {
    try {
      setLoadingAllowedEmails(true)
      const response = await fetch("/api/allowed-emails")
      if (response.ok) {
        const data = await response.json()
        setAllowedEmails(data)
      }
    } catch (error) {
      console.error("Error fetching allowed emails:", error)
    } finally {
      setLoadingAllowedEmails(false)
    }
  }

  const addAllowedEmail = async (email: string, note: string) => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "error",
      })
      return
    }
    
    try {
      const response = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note }),
      })
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Email added to allowed list",
          variant: "success",
        })
        fetchAllowedEmails()
        setShowAddEmailForm(false)
        setNewEmailAddress("")
        setNewEmailNote("")
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to add email",
          variant: "error",
        })
      }
    } catch (error) {
      console.error("Error adding allowed email:", error)
      toast({
        title: "Error",
        description: "Failed to add email",
        variant: "error",
      })
    }
  }

  const deleteAllowedEmail = async (id: string) => {
    const confirmed = await showConfirm(
      "Remove Allowed Email",
      "Are you sure you want to remove this email from the allowed list?",
      {
        confirmText: "Remove",
        cancelText: "Cancel",
        variant: "destructive"
      }
    )
    
    if (!confirmed) return
    
    try {
      const response = await fetch(`/api/allowed-emails/${id}`, {
        method: "DELETE",
      })
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Email removed from allowed list",
          variant: "success",
        })
        fetchAllowedEmails()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to remove email",
          variant: "error",
        })
      }
    } catch (error) {
      console.error("Error deleting allowed email:", error)
      toast({
        title: "Error",
        description: "Failed to remove email",
        variant: "error",
      })
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setCopiedText(label)
    setTimeout(() => {
      setCopied(false)
      setCopiedText("")
    }, 2000)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
      variant: "success",
    })
  }

  if (!show) return null

  return (
    <div className="fixed right-0 top-0 h-full w-[640px] bg-background border-l shadow-xl z-50 transition-all duration-300 ease-out">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your organization and preferences
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-sm px-3 py-1 rounded border hover:bg-muted"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Organization Info */}
            <div className="border rounded p-4">
              <h3 className="text-sm font-medium mb-3">Organization</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm">{organization?.name || session?.user?.organizationSlug}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email Prefix</p>
                  <p className="text-sm">{session?.user?.organizationSlug}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm">{organization?.plan || 'Free'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usage</p>
                  <p className="text-sm">{organization?.monthlyTasksUsed || 0} / {organization?.taskLimit || 100} this month</p>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="border rounded p-4">
              <h3 className="text-sm font-medium mb-3">Account</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{session?.user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm">{session?.user?.name || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm">{session?.user?.organizationRole || 'Admin'}</p>
                </div>
              </div>
            </div>

            {/* Email Configuration */}
            <div className="border rounded p-4">
              <h3 className="text-sm font-medium mb-3">Email Configuration</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Inbound Email Address</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={agentEmail}
                      readOnly
                      className="w-full text-sm border rounded px-2 py-1 pr-8 bg-muted/30"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => copyToClipboard(agentEmail, "settings-email")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={copied && copiedText === "settings-email" ? "Copied!" : "Copy"}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Forward or CC emails to this address to automatically create tasks
                </p>
              </div>
            </div>

            {/* Desktop Notifications */}
            <div className="border rounded p-4">
              <h3 className="text-sm font-medium mb-3">Desktop Notifications</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Get instant alerts when new emails create tasks
              </p>
              {'Notification' in window && Notification.permission === 'default' && (
                <button
                  onClick={async () => {
                    const permission = await Notification.requestPermission()
                    if (permission === 'granted') {
                      toast({
                        title: "Notifications enabled!",
                        description: "You'll be notified when new emails create tasks",
                        variant: "success",
                      })
                    }
                  }}
                  className="w-full text-center text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  🔔 Enable Desktop Notifications
                </button>
              )}
              {'Notification' in window && Notification.permission === 'granted' && (
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-green-600 dark:text-green-400">Desktop notifications enabled</p>
                </div>
              )}
              {'Notification' in window && Notification.permission === 'denied' && (
                <p className="text-xs text-muted-foreground text-center">
                  ❌ Notifications blocked - check browser settings
                </p>
              )}
            </div>

            {/* Timezone Settings */}
            <div className="border rounded p-4">
              <h3 className="text-sm font-medium mb-3">Timezone</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Set your local timezone for accurate task scheduling
              </p>
              <div className="space-y-3">
                {timezoneLoading ? (
                  <>
                    <div className="h-9 w-full rounded bg-muted animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  </>
                ) : (
                  <>
                    <select
                      value={timezone}
                      onChange={async (e) => {
                        const newTimezone = e.target.value
                        onTimezoneChange(newTimezone)
                        
                        // Save to database
                        try {
                          const response = await fetch("/api/user/timezone", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ timezone: newTimezone })
                          })
                          
                          if (response.ok) {
                            toast({
                              title: "Timezone updated",
                              description: `Timezone updated successfully`,
                              variant: "success"
                            })
                            try { localStorage.setItem('everling.tz_manual', '1') } catch {}
                          }
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to update timezone",
                            variant: "error"
                          })
                        }
                      }}
                      className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                    >
                      {timezones.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map(tz => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label} ({tz.offset})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Current time: {new Date().toLocaleString('en-US', { 
                        timeZone: timezone,
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}</p>
                      <p>This affects when tasks are due and when you receive notifications</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Daily Digest */}
            <div className="border rounded p-4">
              <h3 className="text-sm font-medium mb-3">Daily Digest</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Get your tasks delivered via email or SMS every morning
              </p>
              <button 
                onClick={onShowNotifications}
                className="w-full text-center text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Configure Digest
              </button>
            </div>

            {/* Allowed Emails */}
            <div className="border rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Allowed Senders</h3>
                <button
                  onClick={() => setShowAddEmailForm(!showAddEmailForm)}
                  className="text-xs px-2 py-1 rounded border hover:bg-muted"
                >
                  {showAddEmailForm ? 'Cancel' : '+ Add Email'}
                </button>
              </div>
              
              {showAddEmailForm && (
                <div className="mb-4 p-3 border rounded space-y-2 bg-muted/50">
                  <input
                    type="email"
                    placeholder="Email address"
                    value={newEmailAddress}
                    onChange={(e) => setNewEmailAddress(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={newEmailNote}
                    onChange={(e) => setNewEmailNote(e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded bg-background"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => addAllowedEmail(newEmailAddress, newEmailNote)}
                      className="flex-1 px-2 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      Add Email
                    </button>
                    <button
                      onClick={() => {
                        setShowAddEmailForm(false)
                        setNewEmailAddress("")
                        setNewEmailNote("")
                      }}
                      className="px-2 py-1 text-sm border rounded hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mb-3">
                Only emails from these addresses can create tasks. Thread replies are automatically allowed.
              </p>
              
              {loadingAllowedEmails ? (
                <div className="space-y-2">
                  <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-9 w-full rounded bg-muted animate-pulse" />
                  <div className="h-9 w-5/6 rounded bg-muted animate-pulse" />
                </div>
              ) : allowedEmails.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Loading allowed emails...</p>
                  {session?.user?.email && (
                    <div className="p-2 border border-dashed rounded">
                      <p className="text-xs text-muted-foreground">
                        Your registration email ({session.user.email}) will appear here once loaded
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/debug/allowed-emails')
                        const data = await res.json()
                        console.log('Debug info:', data)
                        alert('Check browser console for debug info')
                      }}
                      className="text-xs px-2 py-1 border rounded hover:bg-muted"
                    >
                      Debug Session
                    </button>
                    <button
                      onClick={() => fetchAllowedEmails()}
                      className="text-xs px-2 py-1 border rounded hover:bg-muted"
                    >
                      Retry Loading
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {allowedEmails.map((allowedEmail) => {
                    const isRegistrationEmail = allowedEmail.email === session?.user?.email
                    const isAutoAdded = allowedEmail.note?.includes('auto-added') || 
                                      allowedEmail.note?.includes('Registration email')
                    
                    return (
                      <div key={allowedEmail.id} className={`flex items-center justify-between p-2 border rounded ${
                        isRegistrationEmail ? 'bg-muted/30 border-primary/30' : ''
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono">{allowedEmail.email}</p>
                            {isRegistrationEmail && (
                              <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                Your email
                              </span>
                            )}
                            {isAutoAdded && !isRegistrationEmail && (
                              <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                Auto-added
                              </span>
                            )}
                          </div>
                          {allowedEmail.note && !isAutoAdded && (
                            <p className="text-xs text-muted-foreground">{allowedEmail.note}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Added {formatDate(allowedEmail.createdAt)}
                            {allowedEmail.addedBy && !isAutoAdded && ` by ${allowedEmail.addedBy.name || allowedEmail.addedBy.email}`}
                          </p>
                        </div>
                        {!isRegistrationEmail && (
                          <button
                            onClick={() => deleteAllowedEmail(allowedEmail.id)}
                            className="text-xs text-destructive hover:text-destructive/80"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Email Logs */}
            <div className="border rounded p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Email Logs</h3>
                <button
                  onClick={() => setShowEmailLogsSection(!showEmailLogsSection)}
                  className="text-xs px-2 py-1 rounded border hover:bg-muted"
                >
                  {showEmailLogsSection ? 'Hide' : 'View'} Logs
                </button>
              </div>
              
              {showEmailLogsSection && (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    All emails sent to {agentEmail}
                  </p>
                  
                  {loadingLogs && emailLogs.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">Loading email logs...</p>
                    </div>
                  ) : emailLogs.length === 0 ? (
                    <div className="text-center py-4 border rounded">
                      <p className="text-sm text-muted-foreground">No emails received yet</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Emails sent to {agentEmail} will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {emailLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`p-3 border rounded text-xs ${
                            log.error ? 'border-red-500/50 bg-red-50/10' : 
                            log.processed ? 'border-green-500/50 bg-green-50/10' : 
                            'border-yellow-500/50 bg-yellow-50/10'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate" title={log.subject}>{log.subject}</h4>
                              <p className="text-muted-foreground mt-1 truncate" title={log.fromEmail}>
                                From: {log.fromEmail}
                              </p>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded border ${
                              log.error ? 'border-destructive text-destructive bg-destructive/10' :
                              log.processed ? 'border-green-600 text-green-600 bg-green-600/10 dark:border-green-400 dark:text-green-400 dark:bg-green-400/10' :
                              'border-yellow-600 text-yellow-600 bg-yellow-600/10 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-400/10'
                            }`}>
                              {log.error ? 'Failed' : log.processed ? 'Processed' : 'Pending'}
                            </span>
                          </div>
                          
                          {log.error && (
                            <p className="text-red-600 mb-1">
                              Error: {log.error}
                            </p>
                          )}
                          
                          {log.taskId && (
                            <div className="flex items-center gap-1 mb-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <p className="text-green-600">Task created successfully</p>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-muted-foreground">
                              {formatDateTime(log.createdAt)}
                            </p>
                            {log.rawData && (
                              <button
                                onClick={() => {
                                  if (selectedEmailId === log.id) {
                                    setSelectedRawData(null)
                                    setSelectedEmailId(null)
                                  } else {
                                    setSelectedRawData(log.rawData)
                                    setSelectedEmailId(log.id)
                                  }
                                }}
                                className={`hover:text-foreground ${
                                  selectedEmailId === log.id 
                                    ? 'text-foreground font-medium' 
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {selectedEmailId === log.id ? 'Hide raw' : 'View raw'}
                              </button>
                            )}
                          </div>
                          
                          {selectedEmailId === log.id && selectedRawData && (
                            <div className="mt-3 p-3 bg-muted/50 rounded">
                              <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                                {JSON.stringify(selectedRawData, null, 2)}
                              </pre>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(selectedRawData, null, 2))
                                  toast({
                                    title: "Copied!",
                                    description: "Raw data copied to clipboard",
                                    variant: "success",
                                  })
                                }}
                                className="mt-2 px-2 py-1 text-xs rounded border hover:bg-muted flex items-center gap-1"
                              >
                                <Copy className="h-3 w-3" />
                                Copy JSON
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Danger Zone */}
            <div className="border border-destructive/50 rounded p-4">
              <h3 className="text-sm font-medium mb-3 text-destructive">Danger Zone</h3>
              <p className="text-xs text-muted-foreground mb-3">
                These actions are irreversible. Please be certain.
              </p>
              <button className="text-xs px-3 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10">
                Delete All Tasks
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
