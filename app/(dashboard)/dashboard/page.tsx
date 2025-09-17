"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession, signOut } from "next-auth/react"
import { formatDate, formatDateTime, generateApiKey } from "@/lib/utils"
import { getSmartTaskList, interpretCommand, recordInteraction } from "@/lib/tasks"
import { interpretSearchIntelligently } from "@/lib/tasks-ai"
import { countries, getDefaultCountry, formatPhoneNumber } from "@/lib/countries"
import { timezones, getTimeOptions, getUserTimezone } from "@/lib/timezones"
import { NotificationSetup } from "@/components/notification-setup"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Copy, Circle, Calendar, AlertCircle, Clock, 
  Inbox, ChevronUp, Mail, CheckCircle, RefreshCw,
  Plus, X, Search, ChevronDown, UserCheck, ArrowDownToLine,
  Share2, Eye, Info, Users, UserX, GitBranch, User
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
  // Relationship fields
  assignedToEmail?: string | null
  assignedByEmail?: string | null
  taskType?: string | null
  userRole?: string | null
  stakeholders?: any
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

// Filter types
type TimeFilter = 'today' | 'tomorrow' | 'week' | 'no-date'
type OwnershipFilter = 'my-tasks' | 'waiting-on' | 'observing'

interface FilterState {
  time: TimeFilter[]
  ownership: OwnershipFilter[]
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [searchResults, setSearchResults] = useState<Task[]>([]) 
  const [isSearching, setIsSearching] = useState(false)
  
  // New filter state
  const [filters, setFilters] = useState<FilterState>({
    time: [],
    ownership: []
  })
  const [copied, setCopied] = useState(false)
  const [copiedText, setCopiedText] = useState("")
  const [newTasksCount, setNewTasksCount] = useState(0)
  const [lastTaskCount, setLastTaskCount] = useState(0)
  
  // Drawer states
  const [showEmailLogs, setShowEmailLogs] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showApi, setShowApi] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [selectedRawData, setSelectedRawData] = useState<any>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [newApiKey, setNewApiKey] = useState("")
  
  // Data states
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [organization, setOrganization] = useState<any>(null)
  const [allowedEmails, setAllowedEmails] = useState<any[]>([])
  const [showAddEmailForm, setShowAddEmailForm] = useState(false)
  const [newEmailAddress, setNewEmailAddress] = useState("")
  const [newEmailNote, setNewEmailNote] = useState("")
  const [reminders, setReminders] = useState<any>({ upcoming: [], overdue: [], dueSoon: [] })
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [loadingApi, setLoadingApi] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState("")
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [whatsappVerified, setWhatsappVerified] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountry())
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  
  // Notification preferences
  const [notificationType, setNotificationType] = useState("email") // "email", "sms", "both", "none"
  const [digestTime, setDigestTime] = useState("08:00")
  const [timezone, setTimezone] = useState(getUserTimezone())
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true)
  const [smsDigestEnabled, setSmsDigestEnabled] = useState(false)
  const [showNotificationOnboarding, setShowNotificationOnboarding] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)

  useEffect(() => {
    fetchTasks()
    fetchOrganization()
    fetchReminders()
    
    // Capture and save user's timezone on first load
    captureUserTimezone()
    
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      // We'll ask for permission when they interact with the dashboard
    }
    
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

  // AI-powered search with debouncing - only when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true)
      try {
        // Call the API endpoint that will use AI to interpret the search
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            tasks: tasks,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        })
        
        if (response.ok) {
          const results = await response.json()
          setSearchResults(results)
        } else {
          // Fallback to basic search if AI fails
          const basicResults = interpretCommand(searchQuery, tasks, activeFilters)
          setSearchResults(basicResults)
        }
      } catch (error) {
        console.error('Search error:', error)
        // Fallback to basic search
        const basicResults = interpretCommand(searchQuery, tasks, activeFilters)
        setSearchResults(basicResults)
      } finally {
        setIsSearching(false)
      }
    }, 500) // 500ms debounce for better UX

    return () => clearTimeout(searchTimeout)
  }, [searchQuery]) // Only re-run when searchQuery changes, not on every task update
  
  // Update search results when tasks change (without re-running AI)
  useEffect(() => {
    if (searchQuery.trim() && searchResults.length > 0 && !isSearching) {
      // Update the existing search results with fresh task data
      const resultIds = searchResults.map(r => r.id)
      const updatedResults = tasks.filter(t => resultIds.includes(t.id))
      setSearchResults(updatedResults)
    }
  }, [tasks])

  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/tasks")
      if (response.ok) {
        const data = await response.json()
        
        // Check if there are new tasks from email
        if (!loading && tasks.length > 0) {
          const newEmailTasks = data.filter((task: Task) => {
            // Check if this is a new task created via email that we haven't seen
            const isFromEmail = task.createdVia === 'email'
            const isNew = !tasks.find((t: Task) => t.id === task.id)
            const createdRecently = new Date(task.createdAt).getTime() > Date.now() - 10000 // Created in last 10 seconds
            return isFromEmail && isNew && createdRecently
          })
          
          // Show notification for each new email task
          newEmailTasks.forEach((task: Task) => {
            const fromEmail = task.emailMetadata?.from?.match(/<(.+?)>/)
            const sender = fromEmail ? fromEmail[1] : (task.emailMetadata?.from || 'Unknown sender')
            
            toast({
              title: "📧 New task from email",
              description: `${task.title} - From: ${sender}`,
              variant: "success"
            })
            
            // Play notification sound (using Web Audio API for a simple beep)
            try {
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
              const oscillator = audioContext.createOscillator()
              const gainNode = audioContext.createGain()
              
              oscillator.connect(gainNode)
              gainNode.connect(audioContext.destination)
              
              oscillator.frequency.value = 800 // Frequency in Hz
              oscillator.type = 'sine'
              
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
              
              oscillator.start(audioContext.currentTime)
              oscillator.stop(audioContext.currentTime + 0.3)
            } catch {
              // Fallback: try to play an MP3 if it exists
              try {
                const audio = new Audio('/notification.mp3')
                audio.volume = 0.3
                audio.play().catch(() => {})
              } catch {}
            }
            
            // Browser notification (if permission granted)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New task from email', {
                body: task.title,
                icon: '/icon.png',
                tag: task.id,
              })
            }
          })
          
          // Update the count for the banner (if you still want it)
          if (data.length > lastTaskCount) {
            setNewTasksCount(data.length - lastTaskCount)
            setTimeout(() => setNewTasksCount(0), 5000)
          }
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
  // Build dynamic chips from tags present in tasks
  const chips = useMemo(() => {
    const counts: Record<string, { key: string; value: string; label: string; count: number }> = {}
    const add = (key: string, value?: string | null) => {
      if (!value) return
      const v = String(value).trim()
      if (!v) return
      const id = `${key}:${v.toLowerCase()}`
      if (!counts[id]) counts[id] = { key, value: v.toLowerCase(), label: v, count: 0 }
      counts[id].count++
    }
    for (const t of tasks) {
      const sa = t.emailMetadata?.smartAnalysis || {}
      const tags = sa.tags || {}
      add('what', tags.what)
      add('who', tags.who)
      add('where', tags.where)
      if (sa.projectTag) add('project', sa.projectTag)
      if (Array.isArray(tags.extras)) {
        for (const ex of tags.extras) add('tag', ex)
      }
    }
    // Only include extras that appear more than once to avoid noise
    const list = Object.values(counts).filter(c => c.key !== 'tag' || c.count > 1)
    // Sort by frequency desc, then label
    list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    return list.slice(0, 12)
  }, [tasks])

  const captureUserTimezone = async () => {
    try {
      // Get browser's timezone
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      // Check if we already have this timezone saved
      const response = await fetch("/api/user/timezone")
      if (response.ok) {
        const data = await response.json()
        
        // If timezone is different or not set, update it
        if (data.timezone !== browserTimezone) {
          const updateResponse = await fetch("/api/user/timezone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezone: browserTimezone })
          })
          
          if (updateResponse.ok) {
            console.log("User timezone updated to:", browserTimezone)
          }
        }
      }
    } catch (error) {
      console.error("Error capturing timezone:", error)
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
      } else {
        const errorData = await response.json()
        console.error("Failed to fetch allowed emails:", response.status, errorData)
        // If unauthorized, it might be a session issue
        if (response.status === 401) {
          console.error("Session issue - user might need to log in again")
        }
      }
    } catch (error) {
      console.error("Error fetching allowed emails:", error)
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

  const openSettings = async () => {
    setShowSettings(true)
    setLoadingSettings(false)
    fetchAllowedEmails()
    fetchWhatsAppSettings()
    
    // Fetch user's current timezone
    try {
      const response = await fetch("/api/user/timezone")
      if (response.ok) {
        const data = await response.json()
        if (data.timezone) {
          setTimezone(data.timezone)
        }
      }
    } catch (error) {
      console.error("Error fetching timezone:", error)
    }
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
        
        // Set notification preferences
        if (data.notificationType) {
          setNotificationType(data.notificationType)
          // Hide onboarding if user has already set preferences
          if (data.notificationType !== 'email' || data.digestTime !== '08:00') {
            setShowNotificationOnboarding(false)
          }
        } else {
          // New user - show onboarding
          setShowNotificationOnboarding(true)
          setIsNewUser(true)
        }
        if (data.digestTime) setDigestTime(data.digestTime)
        if (data.timezone) setTimezone(data.timezone)
        if (data.emailDigestEnabled !== undefined) setEmailDigestEnabled(data.emailDigestEnabled)
        if (data.smsDigestEnabled !== undefined) setSmsDigestEnabled(data.smsDigestEnabled)
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

  // Filter toggle function
  const toggleFilter = (type: keyof FilterState, value: any) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      
      // For time and ownership, allow multiple selections
      const currentValues = prev[type] as any[]
      if (currentValues.includes(value)) {
        newFilters[type] = currentValues.filter((v: any) => v !== value) as any
      } else {
        newFilters[type] = [...currentValues, value] as any
      }
      
      // Save to localStorage
      localStorage.setItem('taskFilters', JSON.stringify(newFilters))
      return newFilters
    })
  }

  // Load filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem('taskFilters')
    if (savedFilters) {
      try {
        setFilters(JSON.parse(savedFilters))
      } catch (e) {
        console.error('Failed to load saved filters')
      }
    }
  }, [])

  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    const now = new Date()
    // Set today to start of day in local timezone
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const weekFromNow = new Date(today)
    weekFromNow.setDate(weekFromNow.getDate() + 7)

    // Time filters
    if (filters.time.length > 0) {
      result = result.filter(task => {
        if (!task.dueDate) return filters.time.includes('no-date')
        
        // Parse the task due date and get local date string
        const dueDate = new Date(task.dueDate)
        const taskDateStr = dueDate.toLocaleDateString('en-CA') // Returns YYYY-MM-DD format in local time
        
        // Get today and tomorrow as local date strings
        const todayStr = today.toLocaleDateString('en-CA')
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA')
        const weekFromNowStr = weekFromNow.toLocaleDateString('en-CA')
        
        return filters.time.some(filter => {
          switch (filter) {
            case 'today':
              return taskDateStr === todayStr
            case 'tomorrow':
              return taskDateStr === tomorrowStr
            case 'week':
              // Show tasks due within the next 7 days (including today)
              return taskDateStr >= todayStr && taskDateStr <= weekFromNowStr
            case 'no-date':
              return false // Already handled above
            default:
              return true
          }
        })
      })
    }

    // Ownership filters
    if (filters.ownership.length > 0) {
      result = result.filter(task => {
        return filters.ownership.some(filter => {
          switch (filter) {
            case 'my-tasks':
              return task.userRole === 'executor'
            case 'waiting-on':
              return task.userRole === 'delegator'
            case 'observing':
              return task.userRole === 'observer' || task.taskType === 'fyi'
            default:
              return true
          }
        })
      })
    }

    // Always filter out completed tasks (they'll be shown in the Completed drawer)
    result = result.filter(task => task.status !== 'done')

    // Apply smart ordering to filtered results
    return getSmartTaskList(result, showAllTasks ? 100 : 50) as Task[]
  }, [tasks, filters, showAllTasks])

  const getVisibleTasks = (): Task[] => {
    // If we have AI search results, use them
    if (searchQuery.trim() && searchResults.length >= 0) {
      return searchResults.map((task, index) => ({
        ...task,
        relevanceScore: 1000 - index, // Higher score for earlier results
        relevanceReason: undefined
      }))
    }
    
    // Otherwise use filtered tasks
    return filteredTasks
  }
  
  const visibleTasks = getVisibleTasks()
  const hiddenTaskCount = tasks.filter(t => t.status !== 'done').length - (showAllTasks ? 0 : Math.min(5, visibleTasks.length))

  const agentEmail = session?.user?.organizationSlug 
    ? `${session.user.organizationSlug}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || "everling.io"}`
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

  const isDrawerOpen = showEmailLogs || showSettings || showApi || showNotifications || showCompleted
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
          <div className="mb-12 p-8 border rounded-md relative overflow-hidden">
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
                        everling.io
                      </span>
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

          {/* Minimal AI search */}
          <div className="mb-8">
            <div className="relative">
              {searchQuery && !isSearching ? (
                <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              )}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask me anything..."
                className="h-9 w-full rounded border border-input bg-background pl-9 pr-9 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('')
                  }
                }}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 animate-spin" />
                </div>
              )}
              {searchQuery && !isSearching && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mb-6 space-y-2">
            {/* Time filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => toggleFilter('time', 'today')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.time.includes('today')
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => toggleFilter('time', 'tomorrow')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.time.includes('tomorrow')
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Tomorrow
              </button>
              <button
                onClick={() => toggleFilter('time', 'week')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.time.includes('week')
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => toggleFilter('time', 'no-date')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.time.includes('no-date')
                    ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                No Date
              </button>
              
              <div className="w-px h-6 bg-border mx-1" /> {/* Separator */}
              
              {/* Ownership filters */}
              <button
                onClick={() => toggleFilter('ownership', 'my-tasks')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.ownership.includes('my-tasks')
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => toggleFilter('ownership', 'waiting-on')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.ownership.includes('waiting-on')
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Waiting On
              </button>
              <button
                onClick={() => toggleFilter('ownership', 'observing')}
                className={`inline-flex items-center px-2 py-0.5 text-xs rounded transition-colors ${
                  filters.ownership.includes('observing')
                    ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Observing
              </button>
            </div>
            
            {/* Active filter summary and clear button */}
            {(filters.time.length > 0 || filters.ownership.length > 0) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Showing {visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}
                  {filters.time.length > 0 && ` • ${filters.time.join(', ')}`}
                  {filters.ownership.length > 0 && ` • ${filters.ownership.join(', ')}`}
                </span>
                <button
                  onClick={() => setFilters({ time: [], ownership: [] })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Notification Onboarding - Show for new users or if not configured */}
          {showNotificationOnboarding && (
            <div className="mb-6">
              <NotificationSetup 
                isOnboarding={true}
                onComplete={() => {
                  setShowNotificationOnboarding(false)
                  // Refresh settings
                  fetchWhatsAppSettings()
                }}
              />
            </div>
          )}

          {/* Smart Tasks List - Ultra Minimal */}
          <div className="space-y-3">
            {visibleTasks.length === 0 ? (
              <div className="text-center py-12 border rounded">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? (
                    isSearching ? "Searching..." : `No tasks found for "${searchQuery}"`
                  ) : (
                    "No tasks to show"
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {searchQuery ? (
                    "Try a different search or clear the search to see all tasks"
                  ) : (
                    `Forward an email to ${agentEmail} to create your first task`
                  )}
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
                      <div className="flex-1 min-w-0">
                        {/* Task Relationship Indicators - Minimal UI */}
                        {(task.assignedByEmail || task.taskType === 'tracking' || task.taskType === 'delegation' || 
                          task.taskType === 'assigned') && (
                          <div className="flex flex-wrap items-center gap-1 mb-1.5">
                            {/* Show who requested/assigned this task if it's not from yourself */}
                            {task.assignedByEmail && 
                             task.assignedByEmail !== session?.user?.email && 
                             !task.assignedByEmail.includes('@') && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                from {task.assignedByEmail}
                              </span>
                            )}
                            
                            {/* Show actual email sender if they're different from requester */}
                            {task.assignedByEmail && 
                             task.assignedByEmail.includes('@') && 
                             task.assignedByEmail !== session?.user?.email && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                from {task.assignedByEmail.split('@')[0]}
                              </span>
                            )}
                            
                            {/* Show if this was assigned TO you (not self-created) */}
                            {task.taskType === 'assigned' && task.userRole === 'executor' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                                <ArrowDownToLine className="h-3 w-3" />
                                assigned to me
                              </span>
                            )}
                            
                            {/* Show if this is a self-created task */}
                            {task.taskType === 'self' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                <User className="h-3 w-3" />
                                self
                              </span>
                            )}
                            
                            {/* Show if this is something you need to delegate to someone */}
                            {task.taskType === 'delegation' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-orange-100/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                                <Share2 className="h-3 w-3" />
                                to delegate
                              </span>
                            )}
                            
                            {/* Show if you're just tracking/monitoring this */}
                            {task.taskType === 'tracking' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                                <Eye className="h-3 w-3" />
                                monitoring
                              </span>
                            )}
                            
                            {/* Only show assignment target if it's someone ELSE (not you) */}
                            {task.assignedToEmail && 
                             task.assignedToEmail !== session?.user?.email && 
                             (session?.user?.organizationSlug && !task.assignedToEmail.includes(session.user.organizationSlug)) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                                for {task.assignedToEmail.split('@')[0]}
                              </span>
                            )}
                          </div>
                        )}
                        
                        <h3 className="text-sm font-medium mb-1 truncate" title={task.title}>{task.title}</h3>
                        {task.description && (
                          <div className="text-xs text-muted-foreground mb-2 overflow-hidden" style={{ 
                            wordBreak: 'break-word', 
                            overflowWrap: 'anywhere',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical' 
                          }}>
                            {task.description}
                          </div>
                        )}
                        {/* Meta line (reason/priority) */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.relevanceReason && (
                            <span className="font-medium">{task.relevanceReason}</span>
                          )}
                          {task.priority === 'high' && (
                            <span className="text-red-600">High priority</span>
                          )}
                        </div>

                        {/* Source line (only for email-created tasks) */}
                        {task.createdVia === 'email' && task.emailMetadata?.from && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {(() => {
                              const raw = String(task.emailMetadata.from)
                              const match = raw.match(/<(.+?)>/)
                              const addr = (match ? match[1] : raw).toLowerCase()
                              const label = addr.includes('@') ? addr.split('@')[0] : addr
                              return <span>via email from {label}</span>
                            })()}
                          </div>
                        )}

                        {/* Tags line */}
                        {task.emailMetadata?.smartAnalysis?.tags && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {/* Show actual due date instead of static tags.when */}
                            {task.dueDate && (
                              <span className="px-2 py-0.5 border rounded bg-transparent">
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                            {task.emailMetadata.smartAnalysis.tags.where && (
                              <span className="px-2 py-0.5 border rounded">
                                {task.emailMetadata.smartAnalysis.tags.where}
                              </span>
                            )}
                            {task.emailMetadata.smartAnalysis.tags.who && (
                              <span className="px-2 py-0.5 border rounded">
                                {task.emailMetadata.smartAnalysis.tags.who}
                              </span>
                            )}
                            {task.emailMetadata.smartAnalysis.tags.what && (
                              <span className="px-2 py-0.5 border rounded">
                                {task.emailMetadata.smartAnalysis.tags.what}
                              </span>
                            )}
                            {Array.isArray(task.emailMetadata.smartAnalysis.tags.extras) &&
                              task.emailMetadata.smartAnalysis.tags.extras.slice(0, 2).map((ex: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 border rounded max-w-[200px] truncate">
                                  {ex}
                                </span>
                              ))}
                          </div>
                        )}
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
                onClick={() => setShowCompleted(true)}
                className="hover:text-foreground"
              >
                Completed
              </button>
              <button
                onClick={() => {
                  setShowNotifications(true)
                  fetchWhatsAppSettings()
                }}
                className="hover:text-foreground"
              >
                Daily Digest
              </button>
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
            setShowNotifications(false)
            setShowCompleted(false)
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
                      <select
                        value={timezone}
                        onChange={async (e) => {
                          const newTimezone = e.target.value
                          setTimezone(newTimezone)
                          
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
                    </div>
                  </div>

                  {/* Daily Digest */}
                  <div className="border rounded p-4">
                    <h3 className="text-sm font-medium mb-3">Daily Digest</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Get your tasks delivered via email or SMS every morning
                    </p>
                    <button 
                      onClick={() => {
                        setShowNotifications(true)
                        fetchWhatsAppSettings()
                      }}
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
                    
                    {allowedEmails.length === 0 ? (
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
                            onClick={() => {
                              fetchAllowedEmails()
                            }}
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
                  className="text-sm px-3 py-1 rounded border hover:bg-muted"
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
                        className="w-full text-sm font-mono border rounded px-2 py-1 pr-8 bg-muted/30"
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
                        className="text-xs px-2 py-1 rounded border hover:bg-muted"
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
                          <div key={key.id} className="flex items-center justify-between p-2 border rounded">
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
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api/tasks`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">List Tasks</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
{`GET /api/tasks
Response: [{ id, title, status, priority, dueDate, ... }]`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">Create Task</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
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
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
{`PATCH /api/tasks/{id}
Body: { 
  "status": "todo|in_progress|done",
  "title": "Updated title"
}`}
                        </pre>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium mb-1">Delete Task</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
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
                    className="text-sm px-3 py-1 rounded border hover:bg-muted"
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
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium truncate" title={log.subject}>{log.subject}</h4>
                            <p className="text-xs text-muted-foreground mt-1 truncate" title={log.fromEmail}>
                              From: {log.fromEmail}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded border ${
                            log.error ? 'border-destructive text-destructive bg-destructive/10' :
                            log.processed ? 'border-green-600 text-green-600 bg-green-600/10 dark:border-green-400 dark:text-green-400 dark:bg-green-400/10' :
                            'border-yellow-600 text-yellow-600 bg-yellow-600/10 dark:border-yellow-400 dark:text-yellow-400 dark:bg-yellow-400/10'
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
                          <div className="flex items-center gap-1 mb-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <p className="text-xs text-green-600">Task created successfully</p>
                          </div>
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
                      className="text-sm px-3 py-1 rounded border hover:bg-muted"
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
                        className="text-sm px-3 py-1 rounded border hover:bg-muted flex items-center gap-2"
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
          
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background border rounded-md shadow-xl z-[80] p-6">
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

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="fixed right-0 top-0 h-full w-[640px] bg-background border-l shadow-xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Daily Digest Settings</h2>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <NotificationSetup 
                onComplete={() => {
                  // Refresh settings after save
                  fetchWhatsAppSettings()
                  toast({
                    title: "Success",
                    description: "Notification preferences saved",
                    variant: "success"
                  })
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Completed Tasks Drawer */}
      {showCompleted && (
        <div className="fixed right-0 top-0 h-full w-[640px] bg-background border-l shadow-xl z-50 transition-all duration-300 ease-out">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-semibold">Completed Tasks</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  View and manage completed tasks
                </p>
              </div>
              <button
                onClick={() => setShowCompleted(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
              {tasks.filter(t => t.status === 'done').length === 0 ? (
                <div className="text-center py-12 border rounded">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    No completed tasks yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tasks marked as done will appear here
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground mb-4">
                    {tasks.filter(t => t.status === 'done').length} completed {tasks.filter(t => t.status === 'done').length === 1 ? 'task' : 'tasks'}
                  </div>
                  {tasks
                    .filter(t => t.status === 'done')
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((task) => (
                      <div 
                        key={task.id}
                        className="group border rounded p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm line-through text-muted-foreground">
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span>Completed {formatDate(task.createdAt)}</span>
                                  {task.dueDate && (
                                    <>
                                      <span>•</span>
                                      <span>Was due {formatDate(task.dueDate)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                title="Delete task"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  )
}