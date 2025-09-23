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
          <div className="border rounded-lg p-3 md:p-4">
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
          <div className="border rounded-lg p-3 md:p-4">
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
          <div className="border rounded-lg p-3 md:p-4">
            <h3 className="text-sm font-medium mb-3">Email Forwarding</h3>
            <div className="space-y-4">
              {/* Agent Email */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Forward emails to</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                    {agentEmail}
                  </code>
                  <button
                    onClick={() => copyToClipboard(agentEmail, 'Agent email')}
                    className="p-1.5 hover:bg-muted rounded-md flex-shrink-0"
                  >
                    {copied && copiedText === 'Agent email' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Forward emails to this address to create tasks
                </p>
              </div>

              {/* Allowed Emails */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Allowed senders</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchAllowedEmails}
                      disabled={loadingAllowedEmails}
                      className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      {loadingAllowedEmails ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddEmailForm(true)
                        setNewEmailAddress("")
                        setNewEmailNote("")
                      }}
                      className="text-xs px-3 py-1.5 bg-foreground text-background rounded hover:bg-foreground/90"
                    >
                      Add Email
                    </button>
                  </div>
                </div>

                {/* Add Email Form */}
                {showAddEmailForm && (
                  <div className="p-3 border rounded-lg mb-2 space-y-3">
                    <input
                      type="email"
                      value={newEmailAddress}
                      onChange={(e) => setNewEmailAddress(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      value={newEmailNote}
                      onChange={(e) => setNewEmailNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addAllowedEmail}
                        className="flex-1 text-xs px-3 py-1.5 bg-foreground text-background rounded hover:bg-foreground/90"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddEmailForm(false)
                          setNewEmailAddress("")
                          setNewEmailNote("")
                        }}
                        className="flex-1 text-xs px-3 py-1.5 border rounded hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Allowed Emails List */}
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {allowedEmails.map((email) => (
                    <div key={email.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{email.email}</p>
                        {email.note && (
                          <p className="text-xs text-muted-foreground truncate">{email.note}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteAllowedEmail(email.id, email.email)}
                        className="p-1 hover:bg-background rounded ml-2 flex-shrink-0"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  {allowedEmails.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No allowed emails configured
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div className="border rounded-lg p-3 md:p-4">
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
          <div className="border rounded-lg p-3 md:p-4">
            <button
              onClick={() => setShowEmailLogsSection(!showEmailLogsSection)}
              className="w-full flex items-center justify-between mb-3 hover:opacity-80 transition-opacity"
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
                {emailLogs.length} logs
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
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="border rounded-lg p-3 md:p-4">
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