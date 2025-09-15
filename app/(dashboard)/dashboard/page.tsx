"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { formatDate, formatDateTime, generateApiKey } from "@/lib/utils"
import { getSmartTaskList, interpretCommand, recordInteraction } from "@/lib/tasks"
import { countries, getDefaultCountry, formatPhoneNumber } from "@/lib/countries"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Copy, Circle, Calendar, AlertCircle, Clock, 
  Inbox, ChevronUp, Mail, CheckCircle, RefreshCw,
  Plus, X, Search, ChevronDown
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { showAlert, showConfirm, showPrompt } from "@/components/global-modal"

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  reminderDate: string | null
  createdAt: string
  createdVia: string
  emailMetadata: any
  createdBy: {
    name: string | null
    email: string
  } | null
  assignedTo: {
    name: string | null
    email: string
  } | null
  relevanceScore?: number
  relevanceReason?: string
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

interface ApiKey {
  id: string
  name: string
  keyHint?: string
  lastUsed: string | null
  createdAt: string
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedText, setCopiedText] = useState("")
  const [newTasksCount, setNewTasksCount] = useState(0)
  const [lastTaskCount, setLastTaskCount] = useState(0)
  
  // Drawer states
  const [showEmailLogs, setShowEmailLogs] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showApi, setShowApi] = useState(false)
  const [selectedRawData, setSelectedRawData] = useState<any>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [newApiKey, setNewApiKey] = useState("")
  
  // Data states
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [organization, setOrganization] = useState<any>(null)
  const [allowedEmails, setAllowedEmails] = useState<any[]>([])
  const [reminders, setReminders] = useState<any>({ upcoming: [], overdue: [], dueSoon: [] })
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [loadingApi, setLoadingApi] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [whatsappVerified, setWhatsappVerified] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountry())
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    fetchTasks()
    fetchOrganization()
    fetchReminders()
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchTasks()
      fetchReminders()
      // If email logs drawer is open, refresh those too
      if (showEmailLogs) {
        fetchEmailLogs()
      }
    }, 3000) // Poll every 3 seconds
    
    return () => clearInterval(interval)
  }, [showEmailLogs])

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks")
      if (response.ok) {
        const data = await response.json()
        
        // Check if there are new tasks
        if (!loading && data.length > lastTaskCount) {
          setNewTasksCount(data.length - lastTaskCount)
          // Clear the notification after 5 seconds
          setTimeout(() => setNewTasksCount(0), 5000)
        }
        
        setTasks(data)
        setLastTaskCount(data.length)
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrganization = async () => {
    try {
      const response = await fetch("/api/organization")
      if (response.ok) {
        const data = await response.json()
        setOrganization(data)
      }
    } catch (error) {
      console.error("Error fetching organization:", error)
    }
  }

  const fetchReminders = async () => {
    try {
      const response = await fetch("/api/reminders")
      if (response.ok) {
        const data = await response.json()
        setReminders(data)
      }
    } catch (error) {
      console.error("Error fetching reminders:", error)
    }
  }

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

  const fetchApiKeys = async () => {
    setLoadingApi(true)
    try {
      const response = await fetch("/api/keys")
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data)
      }
    } catch (error) {
      console.error("Error fetching API keys:", error)
    } finally {
      setLoadingApi(false)
    }
  }

  const openEmailLogs = () => {
    setShowEmailLogs(true)
    fetchEmailLogs()
  }

  const fetchAllowedEmails = async () => {
    try {
      const response = await fetch("/api/allowed-emails")
      if (response.ok) {
        const data = await response.json()
        setAllowedEmails(data)
      }
    } catch (error) {
      console.error("Error fetching allowed emails:", error)
    }
  }

  const addAllowedEmail = async (email: string, note: string) => {
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

  const openSettings = () => {
    setShowSettings(true)
    setLoadingSettings(false)
    fetchAllowedEmails()
    fetchWhatsAppSettings()
  }
  
  const fetchWhatsAppSettings = async () => {
    try {
      const response = await fetch('/api/user/sms')
      if (response.ok) {
        const data = await response.json()
        if (data.phoneNumber) {
          // Parse the phone number to extract country and number
          const fullNumber = data.phoneNumber
          // Try to match country code
          const country = countries.find(c => fullNumber.startsWith(c.dialCode))
          if (country) {
            setSelectedCountry(country.code)
            // Remove country code from the number
            const numberWithoutCode = fullNumber.replace(country.dialCode, '')
            setWhatsappPhone(numberWithoutCode)
          } else {
            setWhatsappPhone(fullNumber)
          }
        }
        setWhatsappEnabled(data.enabled)
        setWhatsappVerified(data.verified)
      }
    } catch (error) {
      console.error('Error fetching WhatsApp settings:', error)
    }
  }

  const openApi = () => {
    setShowApi(true)
    fetchApiKeys()
  }

  const createApiKey = async (name: string) => {
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      
      if (response.ok) {
        const data = await response.json()
        // Store the key for display
        setNewApiKey(data.key)
        setShowApiKeyModal(true)
        fetchApiKeys()
      }
    } catch (error) {
      console.error("Error creating API key:", error)
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "error",
      })
    }
  }

  const deleteApiKey = async (id: string) => {
    const confirmed = await showConfirm(
      "Delete API Key",
      "This action cannot be undone. Are you sure you want to delete this API key?",
      {
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "destructive"
      }
    )
    
    if (!confirmed) return
    
    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: "DELETE",
      })
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "API key deleted successfully",
          variant: "success",
        })
        fetchApiKeys()
      }
    } catch (error) {
      console.error("Error deleting API key:", error)
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "error",
      })
    }
  }


  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (response.ok) {
        fetchTasks()
      }
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const deleteTask = async (taskId: string) => {
    const confirmed = await showConfirm(
      "Delete Task",
      "Are you sure you want to delete this task?",
      {
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "destructive"
      }
    )
    
    if (!confirmed) return

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      })
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Task deleted successfully",
          variant: "success",
        })
        fetchTasks()
      }
    } catch (error) {
      console.error("Error deleting task:", error)
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "error",
      })
    }
  }

  // Get smart task list based on search or default ordering
  const getVisibleTasks = (): Task[] => {
    if (searchQuery.trim()) {
      // If searching, use the command interpreter
      const searchResults = interpretCommand(searchQuery, tasks)
      // Add relevance info to search results
      return searchResults.map((task, index) => ({
        ...task,
        relevanceScore: 1000 - index, // Higher score for earlier results
        relevanceReason: undefined
      }))
    }
    
    // Otherwise, use smart relevance ordering
    const smartList = getSmartTaskList(tasks, showAllTasks ? 100 : 5)
    return smartList as Task[]
  }
  
  const visibleTasks = getVisibleTasks()
  const hiddenTaskCount = tasks.filter(t => t.status !== 'done').length - (showAllTasks ? 0 : Math.min(5, visibleTasks.length))

  const agentEmail = session?.user?.organizationSlug 
    ? `${session.user.organizationSlug}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || "yourdomain.com"}`
    : "Loading..."

  const copyEmail = () => {
    navigator.clipboard.writeText(agentEmail)
    toast({
      title: "Copied!",
      description: "Email address copied to clipboard",
      variant: "success",
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
      variant: "success",
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const isDrawerOpen = showEmailLogs || showSettings || showApi
  const isWideDrawer = showEmailLogs && selectedRawData

  return (
    <>
      <div 
        className={`min-h-screen py-12 transition-all duration-300 ease-out ${
          isWideDrawer ? 'mr-[1280px]' : isDrawerOpen ? 'mr-[640px]' : ''
        }`}
      >
        <div className="mx-auto max-w-3xl px-6">
          {/* New Tasks Notification */}
          {newTasksCount > 0 && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-center transition-all duration-300">
              <p className="text-sm text-green-700 dark:text-green-400">
                🎉 {newTasksCount} new {newTasksCount === 1 ? 'task' : 'tasks'} created from email!
              </p>
            </div>
          )}
          
          {/* Header with Agent Email - with gradient background */}
          <div className="mb-12 p-8 border rounded-lg relative overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20" />
            
            {/* Content */}
            <div className="relative">
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Forward or CC any email to create tasks automatically using AI
              </p>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Your agent email</p>
                <div className="inline-flex items-center">
                  <div className="relative group">
                    <div 
                      className="text-lg border rounded px-3 py-1.5 pr-10 bg-background/80 backdrop-blur cursor-pointer flex items-center hover:bg-background/90 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(agentEmail)
                        toast({
                          title: "Copied!",
                          description: "Email address copied to clipboard",
                          variant: "success",
                        })
                      }}
                    >
                      <span className="text-muted-foreground">{session?.user?.organizationSlug}@</span>
                      <span className="text-lg mx-0.5 bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-cyan-500 bg-clip-text text-transparent">
                        {process.env.NEXT_PUBLIC_EMAIL_DOMAIN?.split('.')[0] || "everling"}
                      </span>
                      <span className="text-muted-foreground">.{process.env.NEXT_PUBLIC_EMAIL_DOMAIN?.split('.').slice(1).join('.') || "io"}</span>
                    </div>
                    <button
                      onClick={copyEmail}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy email"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ultra-minimal search bar */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or type a command..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('')
                  }
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Try: "urgent", "tomorrow", "from john", or just start typing
            </p>
          </div>


          {/* Smart Tasks List - Ultra Minimal */}
          <div className="space-y-3">
            {visibleTasks.length === 0 ? (
              <div className="text-center py-12 border rounded">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No matching tasks" : "No tasks to show"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Forward an email to {agentEmail} to create your first task
                </p>
              </div>
            ) : (
              <>
                {visibleTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 border rounded hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium mb-1">{task.title}</h3>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.relevanceReason && (
                            <span className="font-medium">{task.relevanceReason}</span>
                          )}
                          {task.createdBy?.email && (
                            <span>from {task.createdBy.email.split('@')[0]}</span>
                          )}
                          {task.priority === 'high' && (
                            <span className="text-red-600">High priority</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            updateTaskStatus(task.id, 'done')
                            recordInteraction(task.id, 'complete')
                          }}
                          className="text-xs px-2 py-1 border rounded hover:bg-muted"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Show more button */}
                {hiddenTaskCount > 0 && !searchQuery && (
                  <button
                    onClick={() => setShowAllTasks(!showAllTasks)}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAllTasks ? (
                      <>↑ Show less</>
                    ) : (
                      <>↓ {hiddenTaskCount} more {hiddenTaskCount === 1 ? 'task' : 'tasks'}</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t text-center">
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <button
                onClick={openSettings}
                className="hover:text-foreground"
              >
                Settings
              </button>
              <button
                onClick={openEmailLogs}
                className="hover:text-foreground"
              >
                Email logs
              </button>
              <button
                onClick={openApi}
                className="hover:text-foreground"
              >
                API
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for drawers - appears next to content when drawer is open */}
      {isDrawerOpen && (
        <div 
          className={`fixed inset-0 bg-black/10 z-40 transition-all duration-300 ease-out ${
            isWideDrawer ? 'mr-[1280px]' : 'mr-[640px]'
          }`}
          onClick={() => {
            setShowEmailLogs(false)
            setShowSettings(false)
            setShowApi(false)
            setSelectedRawData(null)
            setSelectedEmailId(null)
          }}
        />
      )}

      {/* Settings Drawer */}
      {showSettings && (
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
                  onClick={() => setShowSettings(false)}
                  className="text-sm px-3 py-1 rounded-sm border hover:bg-muted"
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
                        <p className="text-sm">{organization?.tasksCreated || 0} / {organization?.taskLimit || 100} tasks</p>
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
                            className="w-full text-sm border rounded-sm px-2 py-1 pr-8 bg-muted/30"
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

                  {/* SMS Reminders */}
                  <div className="border rounded p-4">
                    <h3 className="text-sm font-medium mb-3">SMS Reminders</h3>
                    <div className="space-y-3">
                      {!whatsappEnabled ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Get instant SMS reminders for your tasks
                          </p>
                          <div>
                            <label className="text-xs text-muted-foreground">Phone Number</label>
                            <div className="flex gap-2 mt-1">
                              {/* Country Selector */}
                              <div className="relative">
                                <button
                                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                  className="flex items-center gap-1 px-2 py-1 border rounded-sm text-sm hover:bg-muted"
                                >
                                  <span className="text-base">
                                    {countries.find(c => c.code === selectedCountry)?.flag}
                                  </span>
                                  <span className="text-xs">
                                    {countries.find(c => c.code === selectedCountry)?.dialCode}
                                  </span>
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                                
                                {showCountryDropdown && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-40" 
                                      onClick={() => setShowCountryDropdown(false)}
                                    />
                                    <div className="absolute top-full mt-1 left-0 w-56 max-h-64 overflow-y-auto bg-background border rounded-sm shadow-lg z-50">
                                      {countries.map((country) => (
                                        <button
                                          key={country.code}
                                          onClick={() => {
                                            setSelectedCountry(country.code)
                                            setShowCountryDropdown(false)
                                          }}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted text-left"
                                        >
                                          <span className="text-base">{country.flag}</span>
                                          <span className="text-xs flex-1">{country.name}</span>
                                          <span className="text-xs text-muted-foreground">{country.dialCode}</span>
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
                                className="flex-1 text-sm border rounded-sm px-2 py-1"
                              />
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (!whatsappPhone) {
                                toast({
                                  title: "Error",
                                  description: "Please enter your phone number",
                                  variant: "error"
                                })
                                return
                              }
                              
                              const fullPhoneNumber = formatPhoneNumber(selectedCountry, whatsappPhone)
                              
                              try {
                                const response = await fetch('/api/user/sms', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    phoneNumber: fullPhoneNumber,
                                    action: 'enable'
                                  })
                                })
                                
                                if (response.ok) {
                                  const data = await response.json()
                                  setWhatsappEnabled(true)
                                  toast({
                                    title: "Success",
                                    description: data.message || "SMS reminders enabled",
                                    variant: "success"
                                  })
                                } else {
                                  const error = await response.json()
                                  toast({
                                    title: "Error",
                                    description: error.error || "Failed to enable SMS",
                                    variant: "error"
                                  })
                                }
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to enable SMS reminders",
                                  variant: "error"
                                })
                              }
                            }}
                            className="w-full text-sm px-3 py-1.5 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
                          >
                            Enable SMS Reminders
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-600">✓ SMS Enabled</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {countries.find(c => c.code === selectedCountry)?.flag}{' '}
                                {countries.find(c => c.code === selectedCountry)?.dialCode}{' '}
                                {whatsappPhone}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/user/sms', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'disable' })
                                  })
                                  
                                  if (response.ok) {
                                    setWhatsappEnabled(false)
                                    setWhatsappPhone("")
                                    toast({
                                      title: "Success",
                                      description: "SMS reminders disabled",
                                      variant: "success"
                                    })
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to disable SMS",
                                    variant: "error"
                                  })
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Disable
                            </button>
                          </div>
                          {whatsappVerified ? (
                            <p className="text-xs text-green-600">✓ Verified and ready to receive reminders</p>
                          ) : (
                            <p className="text-xs text-yellow-600">⚠️ Check your phone for verification SMS</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/user/sms', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'test' })
                                  })
                                  
                                  if (response.ok) {
                                    const data = await response.json()
                                    toast({
                                      title: "Success",
                                      description: data.message || "Test SMS sent",
                                      variant: "success"
                                    })
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to send test SMS",
                                    variant: "error"
                                  })
                                }
                              }}
                              className="text-xs px-2 py-1 border rounded-sm hover:bg-muted"
                            >
                              Send Test SMS
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/cron/daily-digest', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' }
                                  })
                                  
                                  if (response.ok) {
                                    toast({
                                      title: "Success",
                                      description: "Daily digest sent! Check your phone",
                                      variant: "success"
                                    })
                                  } else {
                                    toast({
                                      title: "Error",
                                      description: "Failed to send daily digest",
                                      variant: "error"
                                    })
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to send daily digest",
                                    variant: "error"
                                  })
                                }
                              }}
                              className="text-xs px-2 py-1 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
                            >
                              Send Today's Digest
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Allowed Emails */}
                  <div className="border rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Allowed Senders</h3>
                      <button
                        onClick={async () => {
                          const email = await showPrompt(
                            "Add Allowed Email",
                            "Enter the email address to allow",
                            {
                              confirmText: "Add",
                              cancelText: "Cancel"
                            }
                          )
                          if (email) {
                            addAllowedEmail(email, "")
                          }
                        }}
                        className="text-xs px-2 py-1 rounded-sm border hover:bg-muted"
                      >
                        + Add Email
                      </button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-3">
                      Only emails from these addresses can create tasks. Thread replies are automatically allowed.
                    </p>
                    
                    {allowedEmails.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Loading allowed emails...</p>
                        {session?.user?.email && (
                          <div className="p-2 border border-dashed rounded-sm">
                            <p className="text-xs text-muted-foreground">
                              Your registration email ({session.user.email}) will appear here once loaded
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allowedEmails.map((allowedEmail) => {
                          const isRegistrationEmail = allowedEmail.email === session?.user?.email
                          const isAutoAdded = allowedEmail.note?.includes('auto-added') || 
                                            allowedEmail.note?.includes('Registration email')
                          
                          return (
                            <div key={allowedEmail.id} className={`flex items-center justify-between p-2 border rounded-sm ${
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
                                  className="text-xs text-red-600 hover:text-red-700"
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

                  {/* Danger Zone */}
                  <div className="border border-red-500/50 rounded p-4">
                    <h3 className="text-sm font-medium mb-3 text-red-600">Danger Zone</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      These actions are irreversible. Please be certain.
                    </p>
                    <button className="text-xs px-3 py-1 rounded-sm border border-red-500 text-red-600 hover:bg-red-50">
                      Delete All Tasks
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* API Drawer */}
      {showApi && (
        <div className="fixed right-0 top-0 h-full w-[640px] bg-background border-l shadow-xl z-50 transition-all duration-300 ease-out">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h2 className="text-lg font-semibold">API Access</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage API keys and view documentation
                  </p>
                </div>
                <button
                  onClick={() => setShowApi(false)}
                  className="text-sm px-3 py-1 rounded-sm border hover:bg-muted"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* API Endpoint */}
                  <div className="border rounded p-4">
                    <h3 className="text-sm font-medium mb-3">API Endpoint</h3>
                    <div className="relative">
                      <input
                        type="text"
                        value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api`}
                        readOnly
                        className="w-full text-sm font-mono border rounded-sm px-2 py-1 pr-8 bg-muted/30"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api`, "api-endpoint")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title={copied && copiedText === "api-endpoint" ? "Copied!" : "Copy"}
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* API Keys */}
                  <div className="border rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">API Keys</h3>
                      <button
                        onClick={async () => {
                          const name = await showPrompt(
                            "Create API Key",
                            "Enter a name for this API key:",
                            {
                              confirmText: "Create",
                              cancelText: "Cancel"
                            }
                          )
                          if (name) createApiKey(name)
                        }}
                        className="text-xs px-2 py-1 rounded-sm border hover:bg-muted"
                      >
                        + New Key
                      </button>
                    </div>
                    
                    {loadingApi ? (
                      <p className="text-xs text-muted-foreground">Loading API keys...</p>
                    ) : apiKeys.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No API keys yet</p>
                    ) : (
                      <div className="space-y-2">
                        {apiKeys.map((key) => (
                          <div key={key.id} className="flex items-center justify-between p-2 border rounded-sm">
                            <div>
                              <p className="text-sm font-medium">{key.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Created {formatDate(key.createdAt)} · 
                                {key.lastUsed ? ` Last used ${formatDate(key.lastUsed)}` : ' Never used'}
                              </p>
                              {key.keyHint && (
                                <p className="text-xs font-mono text-muted-foreground mt-1">
                                  sk_{key.keyHint.substring(0, 6)}...****
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => deleteApiKey(key.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* API Documentation */}
                  <div className="border rounded p-4">
                    <h3 className="text-sm font-medium mb-3">Quick Start</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium mb-1">Authentication</p>
                        <pre className="text-xs bg-muted p-2 rounded-sm overflow-x-auto font-mono">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api/tasks`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">List Tasks</p>
                        <pre className="text-xs bg-muted p-2 rounded-sm overflow-x-auto font-mono">
{`GET /api/tasks
Response: [{ id, title, status, priority, dueDate, ... }]`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">Create Task</p>
                        <pre className="text-xs bg-muted p-2 rounded-sm overflow-x-auto font-mono">
{`POST /api/tasks
Body: { 
  "title": "Task title",
  "description": "Optional description",
  "priority": "high|medium|low"
}`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">Update Task</p>
                        <pre className="text-xs bg-muted p-2 rounded-sm overflow-x-auto font-mono">
{`PATCH /api/tasks/{id}
Body: { 
  "status": "todo|in_progress|done",
  "title": "Updated title"
}`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">Delete Task</p>
                        <pre className="text-xs bg-muted p-2 rounded-sm overflow-x-auto font-mono">
{`DELETE /api/tasks/{id}`}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Rate Limits */}
                  <div className="border rounded p-4">
                    <h3 className="text-sm font-medium mb-3">Rate Limits</h3>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>• 100 requests per minute per API key</p>
                      <p>• 1000 requests per hour per API key</p>
                      <p>• Response headers include rate limit status</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Email Logs Drawer */}
      {showEmailLogs && (
        <div 
          className={`fixed right-0 top-0 h-full bg-background border-l shadow-xl z-50 transition-all duration-300 ease-out ${
            selectedRawData ? 'w-[1280px]' : 'w-[640px]'
          }`}
        >
            <div className="flex h-full">
              {/* Email List Section */}
              <div className="flex flex-col h-full" style={{ width: '640px' }}>
                <div className="flex items-center justify-between p-6 border-b">
                  <div>
                    <h2 className="text-lg font-semibold">Email Logs</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      All emails sent to {agentEmail}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEmailLogs(false)
                      setSelectedRawData(null)
                      setSelectedEmailId(null)
                    }}
                    className="text-sm px-3 py-1 rounded-sm border hover:bg-muted"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                {loadingLogs ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-muted-foreground">Loading email logs...</p>
                  </div>
                ) : emailLogs.length === 0 ? (
                  <div className="text-center py-12 border rounded">
                    <p className="text-sm text-muted-foreground">No emails received yet</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Emails sent to {agentEmail} will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-4 border rounded ${
                          log.error ? 'border-red-500/50 bg-red-50/10' : 
                          log.processed ? 'border-green-500/50 bg-green-50/10' : 
                          'border-yellow-500/50 bg-yellow-50/10'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium">{log.subject}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              From: {log.fromEmail}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-sm border ${
                            log.error ? 'border-red-500 text-red-600 bg-red-50' :
                            log.processed ? 'border-green-500 text-green-600 bg-green-50' :
                            'border-yellow-500 text-yellow-600 bg-yellow-50'
                          }`}>
                            {log.error ? 'Failed' : log.processed ? 'Processed' : 'Pending'}
                          </span>
                        </div>
                        
                        {log.error && (
                          <p className="text-xs text-red-600 mb-2">
                            Error: {log.error}
                          </p>
                        )}
                        
                        {log.taskId && (
                          <p className="text-xs text-green-600 mb-2">
                            ✓ Task created successfully
                          </p>
                        )}
                        
                        {!log.error && !log.taskId && log.rawData?.classification && (
                          <div className="text-xs mb-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                              log.rawData.classification.type === 'fyi' 
                                ? 'bg-blue-100 text-blue-700'
                                : log.rawData.classification.type === 'spam'
                                ? 'bg-gray-100 text-gray-700'
                                : log.rawData.classification.type === 'question'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {log.rawData.classification.type === 'fyi' && '📧'}
                              {log.rawData.classification.type === 'spam' && '🚫'}
                              {log.rawData.classification.type === 'question' && '❓'}
                              {log.rawData.classification.type === 'reminder' && '⏰'}
                              {log.rawData.classification.type.toUpperCase()}
                            </span>
                            {log.rawData.classification.reason && (
                              <p className="text-muted-foreground mt-1">
                                {log.rawData.classification.reason}
                              </p>
                            )}
                          </div>
                        )}
                        
                        {log.rawData?.command?.hasCommand && (
                          <div className="text-xs mb-2 p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">💬 Command detected:</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                log.rawData.command.confidence > 0.8 
                                  ? 'bg-green-100 text-green-700'
                                  : log.rawData.command.confidence > 0.6
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {Math.round(log.rawData.command.confidence * 100)}% confident
                              </span>
                            </div>
                            {log.rawData.command.originalCommand && (
                              <p className="text-muted-foreground italic">
                                "{log.rawData.command.originalCommand}"
                              </p>
                            )}
                            {log.rawData.command.parameters && (
                              <div className="mt-1 text-muted-foreground">
                                {log.rawData.command.parameters.dueDate && (
                                  <div>📅 Due: {new Date(log.rawData.command.parameters.dueDate).toLocaleDateString()}</div>
                                )}
                                {log.rawData.command.parameters.reminderDate && (
                                  <div>⏰ Reminder: {new Date(log.rawData.command.parameters.reminderDate).toLocaleString()}</div>
                                )}
                                {log.rawData.command.parameters.priority && (
                                  <div>🔥 Priority: {log.rawData.command.parameters.priority}</div>
                                )}
                                {log.rawData.command.parameters.status && (
                                  <div>📌 Status: {log.rawData.command.parameters.status}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
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
                              className={`text-xs hover:text-foreground ${
                                selectedEmailId === log.id 
                                  ? 'text-foreground font-medium' 
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {selectedEmailId === log.id ? 'Hide raw' : 'View raw'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>

              {/* Raw Data Section */}
              {selectedRawData && (
                <div className="flex flex-col h-full border-l" style={{ width: '640px' }}>
                  <div className="flex items-center justify-between p-6 border-b">
                    <div>
                      <h2 className="text-lg font-semibold">Raw Email Data</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Complete email payload
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRawData(null)
                        setSelectedEmailId(null)
                      }}
                      className="text-sm px-3 py-1 rounded-sm border hover:bg-muted"
                    >
                      Hide
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="bg-muted/50 rounded p-4 font-mono text-xs">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedRawData, null, 2)}
                      </pre>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedRawData, null, 2))
                          toast({
                            title: "Copied!",
                            description: "Raw data copied to clipboard",
                            variant: "success",
                          })
                        }}
                        className="text-sm px-3 py-1 rounded-sm border hover:bg-muted flex items-center gap-2"
                      >
                        <Copy className="h-3 w-3" />
                        Copy JSON
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      )}

      {/* New API Key Modal */}
      {showApiKeyModal && newApiKey && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={() => {
              setShowApiKeyModal(false)
              setNewApiKey("")
            }}
          />
          
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background border rounded-lg shadow-xl z-[80] p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">API Key Created!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Save this key now. It won't be shown again.
              </p>
            </div>

            <div className="mb-4">
              <div className="p-3 bg-muted/50 rounded border">
                <p className="text-xs font-mono break-all select-all">
                  {newApiKey}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newApiKey)
                  toast({
                    title: "Copied!",
                    description: "API key copied to clipboard",
                    variant: "success",
                  })
                }}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Key
              </button>
              <button
                onClick={() => {
                  setShowApiKeyModal(false)
                  setNewApiKey("")
                }}
                className="px-4 py-2 border rounded hover:bg-muted"
              >
                Done
              </button>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                ⚠️ Store this key securely. For security reasons, we only show it once.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}