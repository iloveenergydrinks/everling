"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { formatDate, formatDateTime } from "@/lib/utils"
import { timezones } from "@/lib/timezones"
import { CheckCircle, Copy, X, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { showConfirm, showPrompt } from "@/components/global-modal"
import { DrawerWrapper } from "./DrawerWrapper"

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
  const [emailLogsCount, setEmailLogsCount] = useState<number | null>(null)
  const [selectedRawData, setSelectedRawData] = useState<any>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [showEmailLogsSection, setShowEmailLogsSection] = useState(false)

  // Fetch allowed emails and email logs count when drawer opens
  useEffect(() => {
    if (show) {
      fetchAllowedEmails()
      fetchEmailLogsCount()
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

  const fetchEmailLogsCount = async () => {
    try {
      const response = await fetch("/api/emails?count_only=true")
      if (response.ok) {
        const data = await response.json()
        setEmailLogsCount(data.count)
      }
    } catch (error) {
      console.error("Error fetching email logs count:", error)
    }
  }

  const fetchEmailLogs = async () => {
    setLoadingLogs(true)
    try {
      const response = await fetch("/api/emails")
      if (response.ok) {
        const data = await response.json()
        // Handle both old and new API response formats
        if (Array.isArray(data)) {
          // Old format (backward compatibility)
          setEmailLogs(data)
          setEmailLogsCount(data.length)
        } else {
          // New format with pagination info
          setEmailLogs(data.logs)
          setEmailLogsCount(data.totalCount)
        }
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

  const addAllowedEmail = async () => {
    if (!newEmailAddress) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "error",
      })
      return
    }

    try {
      const response = await fetch("/api/allowed-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newEmailAddress,
          note: newEmailNote,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Email added to allowed list",
          variant: "success",
        })
        setShowAddEmailForm(false)
        setNewEmailAddress("")
        setNewEmailNote("")
        fetchAllowedEmails()
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

  const deleteAllowedEmail = async (id: string, email: string) => {
    const confirmed = await showConfirm(
      "Remove Allowed Email",
      `Are you sure you want to remove ${email} from the allowed list?`,
      {
        confirmText: "Remove",
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

  return (
    <DrawerWrapper
      show={show}
      onClose={onClose}
      title="Settings"
      description="Manage your organization and preferences"
    >
      <div className="p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Organization Info */}
          <div className="border rounded-md p-3 md:p-4">
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
                <p className="text-sm">
                  {organization?.monthlyTasksUsed || 0} / {organization?.monthlyTasksLimit || 100} tasks this month
                </p>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="border rounded-md p-3 md:p-4">
            <h3 className="text-sm font-medium mb-3">Account</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm">{session?.user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm capitalize">{session?.user?.organizationRole || 'member'}</p>
              </div>
            </div>
          </div>

          {/* Email Forwarding */}
          <div className="border rounded-md p-3 md:p-4">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-sm font-medium text-foreground">Email Forwarding</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Create tasks by forwarding emails to your personal task agent
                </p>
              </div>

              {/* Forwarding Address Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-md p-4 border border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Your Task Agent Email
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Forward emails to this address to automatically create tasks
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(agentEmail, 'Agent email')}
                    className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    {copied && copiedText === 'Agent email' ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-md p-3 border border-blue-200/30 dark:border-blue-800/30">
                  <code className="text-sm text-slate-800 dark:text-slate-200 font-mono break-all">
                    {agentEmail}
                  </code>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center">
                <div className="flex-1 border-t border-border"></div>
                <span className="px-3 text-xs text-muted-foreground bg-background">Security</span>
                <div className="flex-1 border-t border-border"></div>
              </div>

              {/* Allowed Senders Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Authorized Senders</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Only emails from these addresses will create tasks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchAllowedEmails}
                      disabled={loadingAllowedEmails}
                      className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    >
                      {loadingAllowedEmails ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddEmailForm(true)
                        setNewEmailAddress("")
                        setNewEmailNote("")
                      }}
                      className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Add Email
                    </button>
                  </div>
                </div>

                {/* Add Email Form */}
                {showAddEmailForm && (
                  <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/30 rounded-md p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={newEmailAddress}
                          onChange={(e) => setNewEmailAddress(e.target.value)}
                          placeholder="colleague@company.com"
                          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground block mb-1">
                          Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={newEmailNote}
                          onChange={(e) => setNewEmailNote(e.target.value)}
                          placeholder="e.g. Work colleague, Personal assistant"
                          className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={addAllowedEmail}
                          className="flex-1 text-xs px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Add Sender
                        </button>
                        <button
                          onClick={() => {
                            setShowAddEmailForm(false)
                            setNewEmailAddress("")
                            setNewEmailNote("")
                          }}
                          className="flex-1 text-xs px-3 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Allowed Emails List */}
                <div className="border rounded-md bg-card">
                  {allowedEmails.length > 0 ? (
                    <div className="divide-y divide-border max-h-[220px] overflow-y-auto pr-2">
                      {allowedEmails.map((email) => (
                        <div key={email.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                              <p className="text-sm font-medium truncate text-foreground">{email.email}</p>
                            </div>
                            {email.note && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5 ml-4">
                                {email.note}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteAllowedEmail(email.id, email.email)}
                            className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md ml-3 flex-shrink-0 transition-colors"
                            title="Remove sender"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">No authorized senders</p>
                      <p className="text-xs text-muted-foreground">
                        Add email addresses that are allowed to create tasks by forwarding emails
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div className="border rounded-md p-3 md:p-4">
            <h3 className="text-sm font-medium mb-3">Timezone</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Times shown in: {timezone}
            </p>
            <select
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
              disabled={timezoneLoading}
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {timezones.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {timezoneLoading && (
              <p className="text-xs text-muted-foreground mt-2">Updating...</p>
            )}
          </div>

          {/* Email Logs Section */}
          <div className="border rounded-md p-3 md:p-4">
            <button
              onClick={() => setShowEmailLogsSection(!showEmailLogsSection)}
              className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
            >
              <h3 className="text-sm font-medium flex items-center gap-2">
                Email Logs
                {showEmailLogsSection ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </h3>
              <span className="text-xs text-muted-foreground">
                {emailLogsCount !== null ? `${emailLogsCount} logs` : '...'}
              </span>
            </button>
            
            {showEmailLogsSection && (
              <div className="space-y-4">
                {loadingLogs && emailLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Loading logs...
                  </p>
                ) : emailLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No email logs yet
                  </p>
                ) : (
                  <>
                    {emailLogsCount && emailLogsCount > 50 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Showing most recent 50 of {emailLogsCount} total logs
                      </p>
                    )}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {emailLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex flex-col gap-2 p-3 border rounded hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium truncate">
                              {log.subject || 'No subject'}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                              log.processed 
                                ? 'bg-green-100 text-green-700' 
                                : log.error 
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {log.processed ? 'Processed' : log.error ? 'Failed' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {log.fromEmail}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </p>
                          {log.error && (
                            <p className="text-xs text-red-600 mt-1">
                              Error: {log.error}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {log.taskId && (
                              <span className="text-xs text-green-600">
                                Task created: {log.taskId.slice(0, 8)}...
                              </span>
                            )}
                            {log.rawData && (
                              <button
                                onClick={() => {
                                  if (selectedEmailId === log.id) {
                                    setSelectedEmailId(null)
                                    setSelectedRawData(null)
                                  } else {
                                    setSelectedEmailId(log.id)
                                    setSelectedRawData(log.rawData)
                                  }
                                }}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {selectedEmailId === log.id ? 'Hide' : 'View'} raw data
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {selectedEmailId === log.id && selectedRawData && (
                          <div className="mt-2 p-2 bg-muted rounded">
                            <p className="text-xs font-medium mb-1">Raw Data:</p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(selectedRawData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="border rounded-md p-3 md:p-4">
            <h3 className="text-sm font-medium mb-3">Notifications</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Configure how you receive task reminders and daily digests
            </p>
            <button 
              onClick={onShowNotifications}
              className="w-full text-sm px-4 py-2.5 bg-foreground text-background rounded hover:bg-foreground/90"
            >
              Configure Notifications
            </button>
          </div>
        </div>
      </div>
    </DrawerWrapper>
  )
}