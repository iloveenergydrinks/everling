"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { formatDate, formatDateTime } from "@/lib/utils"
import { timezones } from "@/lib/timezones"
import { CheckCircle, Copy, X, ChevronDown, ChevronRight, Key, Mail, Shield, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { showConfirm, showPrompt } from "@/components/global-modal"
import { DrawerWrapper } from "./DrawerWrapper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

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
  
  // Security state
  const [authProviders, setAuthProviders] = useState<any>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false)

  // Fetch allowed emails and email logs count when drawer opens
  useEffect(() => {
    if (show) {
      fetchAllowedEmails()
      fetchEmailLogsCount()
      fetchAuthProviders()
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
  
  const fetchAuthProviders = async () => {
    setLoadingProviders(true)
    try {
      const response = await fetch('/api/user/auth-providers')
      if (response.ok) {
        const data = await response.json()
        setAuthProviders(data)
      }
    } catch (error) {
      console.error('Error fetching auth providers:', error)
    } finally {
      setLoadingProviders(false)
    }
  }
  
  const handleGoogleLink = async () => {
    // Sign in with Google, which will link the account due to allowDangerousEmailAccountLinking
    await signIn('google', { 
      callbackUrl: '/dashboard?linked=google',
      redirect: true 
    })
  }
  
  const handlePasswordChange = async () => {
    const hasPassword = authProviders.providers?.password || false
    
    if (hasPassword) {
      // User wants to change existing password
      const currentPassword = await showPrompt(
        'Enter Current Password',
        'Please enter your current password to verify your identity',
        {
          confirmText: 'Continue',
          cancelText: 'Cancel',
          placeholder: 'Current password',
          inputType: 'password'
        }
      )
      
      if (!currentPassword) return
      
      const newPassword = await showPrompt(
        'Enter New Password',
        'Choose a strong password with at least 8 characters',
        {
          confirmText: 'Set Password',
          cancelText: 'Cancel',
          placeholder: 'New password (min 8 characters)',
          inputType: 'password'
        }
      )
      
      if (!newPassword || newPassword.length < 8) {
        if (newPassword && newPassword.length < 8) {
          toast({
            title: "Password too short",
            description: "Password must be at least 8 characters long",
            variant: "error"
          })
        }
        return
      }
      
      // Change the password
      try {
        const response = await fetch('/api/user/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            currentPassword,
            newPassword 
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to change password')
        }
        
        toast({
          title: "Password changed",
          description: "Your password has been updated successfully",
          variant: 'success'
        })
        
        await fetchAuthProviders()
      } catch (error: any) {
        toast({
          title: "Failed to change password",
          description: error.message || "Please check your current password and try again",
          variant: "error"
        })
      }
    } else {
      // User wants to set a new password
      const newPassword = await showPrompt(
        'Set Your Password',
        'Create a password to secure your account. You can use this alongside Google login.',
        {
          confirmText: 'Set Password',
          cancelText: 'Cancel',
          placeholder: 'Enter password (min 8 characters)',
          inputType: 'password'
        }
      )
      
      if (!newPassword || newPassword.length < 8) {
        if (newPassword && newPassword.length < 8) {
          toast({
            title: "Password too short",
            description: "Password must be at least 8 characters long",
            variant: "error"
          })
        }
        return
      }
      
      // Set the password
      try {
        const response = await fetch('/api/user/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to set password')
        }
        
        toast({
          title: "Password set successfully",
          description: "You can now sign in with your email and password",
          variant: 'success'
        })
        
        await fetchAuthProviders()
      } catch (error: any) {
        toast({
          title: "Failed to set password",
          description: error.message || "Could not set password",
          variant: "error"
        })
      }
    }
  }

  const handleGoogleUnlink = async () => {
    // Check if user has a password first
    if (!authProviders.providers?.password) {
      // User needs to set a password first
      const password = await showPrompt(
        'Set a Password First',
        'To unlink Google, you need another way to sign in. Please create a password for your account. This ensures you won\'t lose access.',
        {
          confirmText: 'Set Password',
          cancelText: 'Cancel',
          placeholder: 'Enter a secure password (min 8 characters)',
          inputType: 'password'
        }
      )
      
      if (!password || password.length < 8) {
        if (password && password.length < 8) {
          toast({
            title: "Password too short",
            description: "Password must be at least 8 characters long",
            variant: "error"
          })
        }
        return
      }
      
      // Set the password first
      setUnlinkingGoogle(true)
      try {
        const setPasswordResponse = await fetch('/api/user/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        })
        
        if (!setPasswordResponse.ok) {
          const errorData = await setPasswordResponse.json()
          throw new Error(errorData.error || 'Failed to set password')
        }
        
        toast({
          title: "Password set successfully",
          description: "Now unlinking your Google account...",
          variant: 'success'
        })
        
        // Refresh auth providers
        await fetchAuthProviders()
        
        // Now proceed to unlink Google
        const unlinkResponse = await fetch('/api/user/auth-providers', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'google' })
        })
        
        if (!unlinkResponse.ok) {
          const unlinkData = await unlinkResponse.json()
          throw new Error(unlinkData.error || 'Failed to unlink Google account')
        }
        
        toast({
          title: "Google account unlinked",
          description: "You can now log in with your email and password.",
          variant: 'success'
        })
        
        await fetchAuthProviders()
      } catch (error: any) {
        toast({
          title: "Operation failed",
          description: error.message || "Could not complete the operation",
          variant: "error",
        })
      } finally {
        setUnlinkingGoogle(false)
      }
      
      return
    }
    
    // User already has a password, proceed with normal unlinking
    const confirmed = await showConfirm(
      'Unlink Google Account',
      'Are you sure you want to unlink your Google account? You can still log in with your password.',
      {
        confirmText: 'Unlink',
        variant: 'destructive'
      }
    )
    
    if (!confirmed) return
    
    setUnlinkingGoogle(true)
    try {
      const response = await fetch('/api/user/auth-providers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' })
      })
      
      if (response.ok) {
        toast({
          title: 'Google account unlinked',
          description: 'Your Google account has been unlinked successfully.',
          variant: 'success'
        })
        fetchAuthProviders()
      } else {
        const error = await response.json()
        throw new Error(error.error)
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unlink Google account',
        variant: 'error'
      })
    } finally {
      setUnlinkingGoogle(false)
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
          description: `Added ${newEmailAddress} to allowed senders`,
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
          description: error.error || "Failed to add allowed email",
          variant: "error",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add allowed email",
        variant: "error",
      })
    }
  }

  const deleteAllowedEmail = async (id: string, email: string) => {
    const confirmed = await showConfirm(
      'Remove authorized sender?',
      `Are you sure you want to remove ${email} from the allowed senders list? Emails from this address will no longer create tasks.`,
      {
        confirmText: 'Remove',
        variant: 'destructive'
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
          description: `Removed ${email} from allowed senders`,
          variant: "success",
        })
        fetchAllowedEmails()
      } else {
        toast({
          title: "Error",
          description: "Failed to remove allowed email",
          variant: "error",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove allowed email",
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
      description="Manage your account and preferences"
    >
      <div className="p-4 md:p-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="email">Email Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 md:space-y-6">
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
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No authorized senders yet. Add your email address to start.
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
                Your current timezone affects task deadlines and daily digest times
              </p>
              <select
                value={timezone}
                onChange={(e) => onTimezoneChange(e.target.value)}
                disabled={timezoneLoading}
                className="w-full px-3 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-background"
              >
                {timezones.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
          </TabsContent>
          
          <TabsContent value="security" className="space-y-4 md:space-y-6">
            {/* Authentication Methods */}
            <div className="border rounded-md p-3 md:p-4">
              <h3 className="text-sm font-medium mb-4">Authentication Methods</h3>
              
              {loadingProviders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : authProviders ? (
                <div className="space-y-3">
                  {/* Password */}
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Password</p>
                        <p className="text-xs text-muted-foreground">
                          {authProviders.providers?.password ? 'Configured' : 'Not set'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded text-xs"
                      onClick={handlePasswordChange}
                    >
                      {authProviders.providers?.password ? 'Change Password' : 'Set Password'}
                    </Button>
                  </div>
                  
                  {/* Google */}
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <div>
                        <p className="text-sm font-medium">Google</p>
                        <p className="text-xs text-muted-foreground">
                          {authProviders.providers?.google ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {authProviders.providers?.google ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded text-xs text-red-600 hover:text-red-700"
                        onClick={handleGoogleUnlink}
                        disabled={unlinkingGoogle || !authProviders.canUnlinkGoogle}
                      >
                        {unlinkingGoogle ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Unlinking...</>
                        ) : (
                          'Disconnect'
                        )}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded text-xs"
                        onClick={handleGoogleLink}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                  
                  {/* Magic Link */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Magic Link</p>
                        <p className="text-xs text-muted-foreground">
                          Always available via email
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">Enabled</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load authentication methods</p>
              )}
              
              {authProviders?.providers?.google && !authProviders?.canUnlinkGoogle && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <Shield className="inline h-3 w-3 mr-1" />
                    You need at least one authentication method. Set a password before unlinking Google.
                  </p>
                </div>
              )}
            </div>
            
            {/* Security Info */}
            <div className="border rounded-md p-3 md:p-4">
              <h3 className="text-sm font-medium mb-3">Security Information</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>• Your account is protected with secure authentication</p>
                <p>• We recommend using multiple authentication methods</p>
                <p>• Magic links are sent to {session?.user?.email}</p>
                {authProviders?.hasMultipleAuthMethods && (
                  <p className="text-green-600 dark:text-green-400">
                    ✓ You have multiple authentication methods enabled
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="email" className="space-y-4 md:space-y-6">
            {/* Email Logs Section */}
            <div className="border rounded-md p-3 md:p-4">
              <button
                onClick={() => setShowEmailLogsSection(!showEmailLogsSection)}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight 
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      showEmailLogsSection ? 'rotate-90' : ''
                    }`} 
                  />
                  <h3 className="text-sm font-medium">Email Logs</h3>
                  {emailLogsCount !== null && (
                    <span className="text-xs text-muted-foreground">
                      ({emailLogsCount} {emailLogsCount === 1 ? 'log' : 'logs'})
                    </span>
                  )}
                </div>
              </button>

              {showEmailLogsSection && (
                <div className="mt-4">
                  {loadingLogs ? (
                    <p className="text-sm text-muted-foreground">Loading logs...</p>
                  ) : (
                    <>
                      {emailLogs.length > 0 && emailLogsCount && emailLogs.length < emailLogsCount && (
                        <div className="mb-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                          Showing {emailLogs.length} most recent logs out of {emailLogsCount} total
                        </div>
                      )}
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {emailLogs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No email logs yet</p>
                        ) : (
                          emailLogs.map((log) => (
                            <div 
                              key={log.id} 
                              className={`p-3 border rounded text-xs space-y-1 ${
                                log.processed 
                                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' 
                                  : log.error 
                                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                                  : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
                              }`}
                            >
                              <div>
                                <span className="font-medium">From:</span> {log.fromEmail}
                              </div>
                              <div>
                                <span className="font-medium">Subject:</span> {log.subject}
                              </div>
                              <div>
                                <span className="font-medium">Time:</span> {formatDateTime(log.createdAt)}
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">Status:</span> {
                                    log.processed ? (
                                      <span className="text-green-700 dark:text-green-400">Processed</span>
                                    ) : log.error ? (
                                      <span className="text-red-700 dark:text-red-400">Failed</span>
                                    ) : (
                                      <span className="text-yellow-700 dark:text-yellow-400">Pending</span>
                                    )
                                  }
                                  {log.taskId && (
                                    <span className="ml-2 text-green-600">Task created</span>
                                  )}
                                  {log.error && (
                                    <span className="ml-2 text-red-600">{log.error}</span>
                                  )}
                                </div>
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
                              
                              {selectedEmailId === log.id && selectedRawData && (
                                <div className="mt-2 p-2 bg-muted rounded">
                                  <p className="text-xs font-medium mb-1">Raw Data:</p>
                                  <pre className="text-xs overflow-x-auto">
                                    {JSON.stringify(selectedRawData, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DrawerWrapper>
  )
}