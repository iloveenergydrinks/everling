"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession, signOut } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { getSmartTaskList, interpretCommand } from "@/lib/tasks"
import { NotificationSetup } from "@/components/notification-setup"
import { getUserTimezone } from "@/lib/timezones"
import { toast } from "@/hooks/use-toast"
import { 
  Copy, Circle, Calendar, AlertTriangle,
  Plus, X, Search, RefreshCw, ArrowDownToLine,
  CheckCircle, User, ChevronDown
} from "lucide-react"
import { CompactTimezoneIndicator } from "@/components/compact-timezone-indicator"
import { WelcomeCard } from "@/components/welcome-card"

// Import drawer components
import { SettingsDrawer } from "./components/SettingsDrawer"
import { IntegrationsDrawer } from "./components/IntegrationsDrawer"
import { NotificationsDrawer } from "./components/NotificationsDrawer"
import { HowItWorksDrawer } from "./components/HowItWorksDrawer"
import { OrganizationDrawer } from "./components/OrganizationDrawer"
import { ApiKeyModal } from "./components/ApiKeyModal"
import { TaskList } from "./components/TaskList"
import { OrganizationSwitcher } from "./components/OrganizationSwitcher"
import { Task, FilterState, TimeFilter } from "./components/types"

export default function DashboardPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [searchResults, setSearchResults] = useState<Task[]>([]) 
  const [isSearching, setIsSearching] = useState(false)
  const [searchCompleted, setSearchCompleted] = useState(false)
  const [showSearchNudgeDelayed, setShowSearchNudgeDelayed] = useState(false)

  // Command mode states
  const [commandMode, setCommandMode] = useState<{
    active: boolean
    command: string
    targets: Task[]
    confirmation: string
  } | null>(null)
  
  const [aiCommand, setAiCommand] = useState<{
    action: string
    createTask?: any
    createTasks?: any[]
    bulkAction?: any
    confidence: number
    metadata?: {
      taskType: string
      userRole: string
      createdVia: string
    }
  } | null>(null)
  
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    time: []
  })
  
  // View mode for task display
  const [viewMode, setViewMode] = useState<'all' | 'assigned' | 'created' | 'shared' | 'team'>('all')
  const [showViewDropdown, setShowViewDropdown] = useState(false)

  // Discord connection state
  const [discordConnectedUI, setDiscordConnectedUI] = useState<boolean>(false)
  const [discordUsernameUI, setDiscordUsernameUI] = useState<string>("")

  // Drawer states
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showIntegrations, setShowIntegrations] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showOrganization, setShowOrganization] = useState(false)
  
  // Other UI states
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [newApiKey, setNewApiKey] = useState("")
  const [organization, setOrganization] = useState<any>(null)
  const [reminders, setReminders] = useState<any>({ upcoming: [], overdue: [], dueSoon: [] })
  const [timezone, setTimezone] = useState(getUserTimezone())
  const [timezoneLoading, setTimezoneLoading] = useState(false)
  const [showNotificationOnboarding, setShowNotificationOnboarding] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)

  // Load saved timezone on component mount
  useEffect(() => {
    const fetchUserTimezone = async () => {
      try {
        const response = await fetch("/api/user/timezone")
        if (response.ok) {
          const data = await response.json()
          if (data.timezone) {
            setTimezone(data.timezone)
          }
        }
      } catch (error) {
        console.error("Error fetching saved timezone:", error)
      }
    }
    fetchUserTimezone()
  }, []) // Only run on mount

  // Show hint after user stops typing
  useEffect(() => {
    if (!searchQuery.trim() || isSearching || isProcessingAI) {
      setShowSearchNudgeDelayed(false)
      return
    }
    const t = setTimeout(() => setShowSearchNudgeDelayed(true), 1000)
    return () => clearTimeout(t)
  }, [searchQuery, isSearching, isProcessingAI])

  // Initialize Discord connection state
  useEffect(() => {
    if (session?.user) {
      setDiscordConnectedUI(Boolean(session.user.discordConnected))
      setDiscordUsernameUI(session.user.discordUsername || "")
    }
  }, [session])

  // Listen for Discord connection messages from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DISCORD_CONNECTED') {
        setDiscordConnectedUI(true)
        setDiscordUsernameUI(event.data.username)
        toast({
          title: "Discord connected",
          description: `Connected as ${event.data.username}`,
        })
        // Fetch fresh Discord status after connection
        setTimeout(() => fetchDiscordStatus(), 1000)
      }
    }
    
    // Listen for Discord status updates from IntegrationsDrawer
    const handleDiscordStatusUpdate = (event: CustomEvent) => {
      if (event.detail) {
        setDiscordConnectedUI(event.detail.connected)
        setDiscordUsernameUI(event.detail.username || "")
      }
    }
    
    window.addEventListener('message', handleMessage)
    window.addEventListener('discord-status-update', handleDiscordStatusUpdate as any)
    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('discord-status-update', handleDiscordStatusUpdate as any)
    }
  }, [])
  
  // Check for Google linking success
  useEffect(() => {
    if (searchParams?.get('linked') === 'google') {
      toast({
        title: 'Google account linked!',
        description: 'You can now sign in with your Google account.',
        variant: 'success'
      })
      // Remove the parameter from URL to prevent showing on refresh
      const url = new URL(window.location.href)
      url.searchParams.delete('linked')
      window.history.replaceState({}, '', url)
    }
  }, [searchParams])

  // Initial data fetching
  useEffect(() => {
    fetchTasks()
    fetchOrganization()
    fetchReminders()
    captureUserTimezone()
    fetchWhatsAppSettings() // This also fetches the user's timezone
    fetchDiscordStatus() // Fetch Discord status on mount
    
    // Initialize Discord bot
    fetch('/api/discord/init')
      .then(res => res.json())
      .then(data => {
        if (data.online) {
          console.log('Discord bot is online')
        }
      })
      .catch(err => console.error('Discord bot init failed:', err))
    
    // Set up polling for real-time updates (more frequent)
    const interval = setInterval(() => {
      fetchTasks()
      fetchReminders()
    }, 1500) // Reduced from 3000ms to 1500ms for faster updates
    
    return () => clearInterval(interval)
  }, [])
  
  // Refetch tasks when view mode changes
  useEffect(() => {
    if (!loading) { // Only refetch after initial load
      fetchTasks()
    }
  }, [viewMode])

  // Process AI commands
  const processAICommand = async (query: string) => {
    if (query.trim().length < 3) return false
    
    setIsProcessingAI(true)
    try {
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: query,
          context: { 
            currentTasks: tasks.length,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
          }
        })
      })
      
      if (response.ok) {
        const command = await response.json()
        
        if (command.confidence > 0.5) {
          if (command.action === 'search') {
            return false // Let regular search handle it
          } else if (command.action === 'delete' || command.action === 'complete') {
            // Find matching tasks based on AI's understanding
            let targetTasks: Task[] = []
            
            if (command.targetTasks?.filter === 'all') {
              targetTasks = tasks.filter(t => t.status !== 'done')
            } else if (command.targetTasks?.filter === 'today') {
              const today = new Date().toLocaleDateString('en-CA')
              targetTasks = tasks.filter(t =>
                t.status !== 'done' && t.dueDate &&
                new Date(t.dueDate).toLocaleDateString('en-CA') === today
              )
            } else if (command.targetTasks?.filter === 'overdue') {
              const now = new Date()
              targetTasks = tasks.filter(t =>
                t.status !== 'done' && t.dueDate &&
                new Date(t.dueDate) < now
              )
            } else if (command.targetTasks?.filter === 'completed') {
              targetTasks = tasks.filter(t => t.status === 'done')
            } else if (command.targetTasks?.searchTerms) {
              const searchTerms = command.targetTasks.searchTerms.toLowerCase()
              targetTasks = tasks.filter(t => 
                t.title.toLowerCase().includes(searchTerms) || 
                (t.description && t.description.toLowerCase().includes(searchTerms))
              )
            }
            
            if (targetTasks.length > 0) {
              setCommandMode({
                active: true,
                command: command.action,
                targets: targetTasks,
                confirmation: `${command.action === 'delete' ? 'Delete' : 'Complete'} ${targetTasks.length} task${targetTasks.length > 1 ? 's' : ''}?`
              })
              return true
            }
          } else if (command.action === 'create' && (command.createTask || command.createTasks)) {
            setAiCommand(command)
            return true
          }
        }
      }
    } catch (error) {
      console.error('AI command processing error:', error)
    } finally {
      setIsProcessingAI(false)
    }
    
    return false
  }

  // Execute AI command (create tasks)
  const executeAICommand = async () => {
    if (!aiCommand || (!aiCommand.createTask && !aiCommand.createTasks)) return
    
    try {
      if (aiCommand.createTask) {
        const taskData = {
          title: aiCommand.createTask.title,
          description: aiCommand.createTask.description,
          priority: aiCommand.createTask.priority || 'medium',
          dueDate: aiCommand.createTask.dueDate,
          reminderDate: aiCommand.createTask.reminderDate,
          emailMetadata: {
            smartAnalysis: {
              tags: aiCommand.createTask.tags,
            }
          },
          taskType: aiCommand.metadata?.taskType || 'self',
          userRole: aiCommand.metadata?.userRole || 'executor',
          createdVia: aiCommand.metadata?.createdVia || 'chat'
        }
        
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData)
        })
        
        if (response.ok) {
          toast({
            title: "Task created",
            description: aiCommand.createTask.title,
            variant: "success"
          })
          fetchTasks()
          setAiCommand(null)
          setSearchQuery('')
        }
      } else if (aiCommand.createTasks) {
        let successCount = 0
        
        for (const task of aiCommand.createTasks) {
          const taskData = {
            title: task.title,
            description: task.description,
            priority: task.priority || 'medium',
            dueDate: task.dueDate,
            reminderDate: task.reminderDate,
            emailMetadata: {
              smartAnalysis: {
                tags: task.tags,
              }
            },
            taskType: aiCommand.metadata?.taskType || 'self',
            userRole: aiCommand.metadata?.userRole || 'executor',
            createdVia: aiCommand.metadata?.createdVia || 'chat'
          }
          
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
          })
          
          if (response.ok) {
            successCount++
          }
        }
        
        if (successCount > 0) {
          toast({
            title: `${successCount} task${successCount > 1 ? 's' : ''} created`,
            description: `Successfully created ${successCount} of ${aiCommand.createTasks.length} tasks`,
            variant: "success"
          })
          fetchTasks()
          setAiCommand(null)
          setSearchQuery('')
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create task(s)",
        variant: "error"
      })
    }
  }

  // Execute bulk command
  const executeCommand = async () => {
    if (!commandMode) return
    
    try {
      const response = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: commandMode.command,
          taskIds: commandMode.targets.map(t => t.id)
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: `${result.count} task${result.count > 1 ? 's' : ''} ${commandMode.command === 'delete' ? 'deleted' : 'completed'}`,
          variant: "success"
        })
        fetchTasks()
        setSearchQuery('')
        setCommandMode(null)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${commandMode.command} tasks`,
        variant: "error"
      })
    }
  }

  // Handle search/command submission
  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return

    // Always try AI first
    const aiHandled = await processAICommand(searchQuery)
    if (aiHandled) return

    // Otherwise do a search
    setIsSearching(true)
    setSearchCompleted(false)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          tasks: tasks,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })
      
      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)
        setSearchCompleted(true)
        
        if (results.length === 0) {
          setTimeout(() => {
            setSearchQuery('')
            setSearchResults([])
            setSearchCompleted(false)
          }, 3000)
        }
      } else {
        const basicResults = interpretCommand(searchQuery, tasks, [])
        setSearchResults(basicResults)
        setSearchCompleted(true)
      }
    } catch (error) {
      console.error('Search error:', error)
      const basicResults = interpretCommand(searchQuery, tasks, [])
      setSearchResults(basicResults)
      setSearchCompleted(true)
    } finally {
      setIsSearching(false)
    }
  }

  // Clear search when query is empty
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearchCompleted(false)
      setIsSearching(false)
      setCommandMode(null)
      setAiCommand(null)
    } else {
      setSearchCompleted(false)
    }
  }, [searchQuery])
  
  // Update search results when tasks change
  useEffect(() => {
    if (searchQuery.trim() && searchResults.length > 0 && !isSearching) {
      const resultIds = searchResults.map(r => r.id)
      const updatedResults = tasks.filter(t => resultIds.includes(t.id))
      setSearchResults(updatedResults)
    }
  }, [tasks])

  // Fetch functions
  const fetchTasks = async () => {
    try {
      const url = viewMode === 'all' 
        ? "/api/tasks"
        : `/api/tasks?filter=${viewMode}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setTasks(data)
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

  const fetchDiscordStatus = async () => {
    try {
      const response = await fetch('/api/user/discord-status')
      if (response.ok) {
        const data = await response.json()
        setDiscordConnectedUI(data.connected)
        setDiscordUsernameUI(data.username || "")
      }
    } catch (error) {
      console.error('Error fetching Discord status:', error)
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

  const fetchWhatsAppSettings = async () => {
    try {
      const response = await fetch('/api/user/sms')
      if (response.ok) {
        const data = await response.json()
        
        if (data.notificationType) {
          if (data.notificationType !== 'email' || data.digestTime !== '08:00') {
            setShowNotificationOnboarding(false)
          }
        } else {
          setShowNotificationOnboarding(true)
          setIsNewUser(true)
        }
        if (data.timezone) setTimezone(data.timezone)
      }
    } catch (error) {
      console.error('Error fetching WhatsApp settings:', error)
    }
  }

  const captureUserTimezone = async () => {
    try {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      const response = await fetch("/api/user/timezone")
      if (response.ok) {
        const data = await response.json()
        const manualSet = (() => {
          try { return localStorage.getItem('everling.tz_manual') === '1' } catch { return false }
        })()

        if (!manualSet && !data.timezone) {
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

  const openSettings = async () => {
    setShowSettings(true)
    fetchWhatsAppSettings()
    // Timezone is already fetched on component mount
  }

  // Handle timezone change - save to database
  const handleTimezoneChange = async (newTimezone: string) => {
    setTimezone(newTimezone) // Update local state immediately
    setTimezoneLoading(true)
    
    try {
      const response = await fetch("/api/user/timezone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timezone: newTimezone }),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log("Timezone updated:", data.timezone)
        toast({
          title: "Success",
          description: "Timezone updated successfully",
          variant: "success",
        })
      } else {
        // Revert on error
        const currentResponse = await fetch("/api/user/timezone")
        if (currentResponse.ok) {
          const currentData = await currentResponse.json()
          setTimezone(currentData.timezone)
        }
        toast({
          title: "Error",
          description: "Failed to update timezone",
          variant: "error",
        })
      }
    } catch (error) {
      console.error("Error updating timezone:", error)
      // Try to revert to saved timezone on error
      try {
        const response = await fetch("/api/user/timezone")
        if (response.ok) {
          const data = await response.json()
          setTimezone(data.timezone)
        }
      } catch {}
      toast({
        title: "Error",
        description: "Failed to update timezone",
        variant: "error",
      })
    } finally {
      setTimezoneLoading(false)
    }
  }

  // Filter toggle function
  const toggleFilter = (type: keyof FilterState, value: any) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      const currentValues = prev[type] as any[]
      
      if (currentValues.includes(value)) {
        newFilters[type] = currentValues.filter((v: any) => v !== value) as any
      } else {
        newFilters[type] = [...currentValues, value] as any
      }
      
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const weekFromNow = new Date(today)
    weekFromNow.setDate(weekFromNow.getDate() + 7)

    // Handle completed filter first
    if (filters.time.includes('completed')) {
      result = result.filter(task => task.status === 'done')
      return result
    } else {
      result = result.filter(task => task.status !== 'done')
    }

    // Time filters
    const nonCompletedTimeFilters = filters.time.filter(f => f !== 'completed')
    if (nonCompletedTimeFilters.length > 0) {
      result = result.filter(task => {
        if (!task.dueDate) return nonCompletedTimeFilters.includes('no-date')

        const dueDate = new Date(task.dueDate)
        const taskDateStr = dueDate.toLocaleDateString('en-CA')
        const todayStr = today.toLocaleDateString('en-CA')
        const tomorrowStr = tomorrow.toLocaleDateString('en-CA')
        const weekFromNowStr = weekFromNow.toLocaleDateString('en-CA')

        return nonCompletedTimeFilters.some(filter => {
          switch (filter) {
            case 'today':
              return taskDateStr === todayStr
            case 'tomorrow':
              return taskDateStr === tomorrowStr
            case 'week':
              return taskDateStr >= todayStr && taskDateStr <= weekFromNowStr
            case 'no-date':
              return false
            case 'expired':
              return dueDate < now
      default:
        return true
    }
  })
      })
    }

    // View mode is now handled by API filter, not here

    // Auto-hide expired tasks unless filter is active
    if (!filters.time.includes('expired')) {
      result = result.filter(task => {
        if (!task.dueDate) return true
        const due = new Date(task.dueDate)
        if (isNaN(due.getTime())) return true
        const diffMs = now.getTime() - due.getTime()
        const hours = diffMs / (1000 * 60 * 60)
        return !(diffMs > 0 && hours > 48)
      })
    }

    // Apply smart ordering to filtered results
    return getSmartTaskList(result, showAllTasks ? 100 : 50) as Task[]
  }, [tasks, filters, showAllTasks])

  const getVisibleTasks = (): Task[] => {
    if (searchQuery.trim() && !isSearching && searchCompleted) {
      return searchResults.map((task, index) => ({
        ...task,
        relevanceScore: 1000 - index,
        relevanceReason: undefined
      }))
    }
    return filteredTasks
  }
  
  const visibleTasks = getVisibleTasks()

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

  const handleDiscordConnect = () => {
    window.open('/api/integrations/discord/connect', 'discord-oauth', 'width=600,height=700')
  }

  const handleDiscordDisconnect = async () => {
    try {
      const res = await fetch('/api/integrations/discord/disconnect', {
        method: 'POST'
      })
      if (res.ok) {
        toast({
          title: "Discord disconnected",
          description: "Your Discord account has been unlinked.",
        })
        setDiscordConnectedUI(false)
        setDiscordUsernameUI("")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect Discord"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // Each drawer handles its own backdrop and animations now
  // No need for dashboard-level backdrop or content shifting

  return (
    <>
      <div className="min-h-screen py-8 md:py-12">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          {/* Organization Switcher */}
          <div className="mb-6 flex justify-between items-center">
            <OrganizationSwitcher key={organization?.updatedAt} />
            <div className="text-sm text-muted-foreground">
              {session?.user?.email}
            </div>
          </div>

          {/* Monthly Usage Warning Banner */}
          {organization && organization.plan === 'free' && (
            <>
              {organization.monthlyTasksUsed >= organization.taskLimit ? (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-red-700 dark:text-red-400">
                      ⚠️ Monthly limit reached! You've used all {organization.taskLimit} tasks this month.
                    </p>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Upgrade to Pro
                    </button>
            </div>
                </div>
              ) : organization.monthlyTasksUsed >= organization.taskLimit * 0.95 ? (
                <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded transition-all duration-300">
                  <p className="text-sm text-orange-700 dark:text-orange-400">
                    ⚠️ Only {organization.taskLimit - organization.monthlyTasksUsed} tasks remaining this month!
                  </p>
                </div>
              ) : organization.monthlyTasksUsed >= organization.taskLimit * 0.8 ? (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded transition-all duration-300">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    You've used {organization.monthlyTasksUsed} of {organization.taskLimit} tasks this month
                  </p>
                </div>
              ) : null}
            </>
          )}
          
          {/* Header with Agent Email */}
          <div className="mb-8">
            <div className="relative overflow-hidden rounded-md border p-6 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 dark:from-blue-950/30 dark:via-transparent dark:to-purple-950/30">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1">
                    Meet Everling, Your Friendly AI Assistant
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Send or forward any email • I'll turn chaos into organized tasks in seconds
                  </p>
                </div>
                <div className="relative">
                  <img 
                    src="/everling_logo.png" 
                    alt="Everling" 
                    className="h-10 w-10 md:h-16 md:w-16 opacity-80 dark:opacity-60 animate-float drop-shadow-md"
                  />
                </div>
              </div>
              <div className="relative group/email">
                <div className="px-4 py-3 bg-background/60 backdrop-blur-sm rounded-md border border-border/50 hover:bg-background/80 transition-colors cursor-pointer" onClick={copyEmail}>
                  <p className="text-xs text-muted-foreground mb-1">Send, forward, or CC any email</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm tracking-wide">
                      <span className="text-muted-foreground">{session?.user?.organizationSlug}@</span>
                      <span className="text-foreground font-semibold">everling.io</span>
                    </p>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover/email:text-foreground transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Welcome Card for new users */}
          <WelcomeCard 
            organizationEmail={`${session?.user?.organizationSlug}@everling.io`} 
          />

          {/* AI Search/Command Interface */}
          <div className="mb-8">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask anything or describe a task..."
                disabled={commandMode !== null || aiCommand !== null || isSearching || isProcessingAI}
                className={`h-12 w-full rounded-md border ${
                  commandMode ? 'border-orange-500 dark:border-orange-400' : 
                  aiCommand ? 'border-emerald-500 dark:border-emerald-400' :
                  searchFocused ? 'border-primary' : 'border-input'
                } bg-background pl-4 ${searchQuery ? 'pr-20' : 'pr-12'} text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50`}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('')
                    setCommandMode(null)
                    setAiCommand(null)
                    setSearchResults([])
                    setSearchFocused(false)
                    e.currentTarget.blur()
                  } else if (e.key === 'Enter' && searchQuery.trim() && !isSearching && !isProcessingAI) {
                    e.preventDefault()
                    handleSearchSubmit()
                  }
                }}
              />
              {searchQuery.trim() && !isSearching && !isProcessingAI && showSearchNudgeDelayed && (
                <div className="absolute right-24 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground select-none pointer-events-none animate-in fade-in duration-500">
                  <kbd className="px-1.5 py-0.5 rounded border bg-muted">Enter</kbd>
                  <span>to run</span>
                </div>
              )}
              {searchQuery && (
                <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                  setSearchCompleted(false)
                  setCommandMode(null)
                  setAiCommand(null)
                }}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={handleSearchSubmit}
                disabled={!searchQuery.trim() || isSearching || isProcessingAI}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded transition-all duration-200 ${
                  !searchQuery.trim() || isSearching || isProcessingAI
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : commandMode
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : aiCommand
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
                title={isSearching || isProcessingAI ? "Processing..." : "Send"}
              >
                {isSearching || isProcessingAI ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-3.5 w-3.5 -rotate-90" />
                )}
              </button>
            </div>
            
            {/* Command suggestions when focused */}
            {searchFocused && !searchQuery && !commandMode && (
              <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in duration-200">
                <button
                  onClick={async () => {
                    setSearchQuery('add task to review budget tomorrow')
                    setSearchFocused(false)
                    setTimeout(() => handleSearchSubmit(), 100)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-emerald-100/50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  add task
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('high priority')
                    setSearchFocused(false)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <Search className="h-3 w-3 mr-1" />
                  high priority
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('due today')
                    setSearchFocused(false)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  due today
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('from kevin')
                    setSearchFocused(false)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
                >
                  <User className="h-3 w-3 mr-1" />
                  from kevin
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('delete all')
                    setSearchFocused(false)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-red-100/50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  delete all
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('complete today')
                    setSearchFocused(false)
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs rounded bg-green-100/50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  complete today
                </button>
            </div>
            )}
            
            {/* AI Task Creation Preview */}
            {aiCommand && (aiCommand.createTask || aiCommand.createTasks) && (
              <div className="mt-3 p-4 border rounded bg-muted/30 animate-in fade-in duration-200">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">
                    {aiCommand.createTasks ? `Create ${aiCommand.createTasks.length} tasks` : 'Create new task'}
                  </h3>
                  
                  {/* Single task preview */}
                  {aiCommand.createTask && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Title</label>
                        <div className="text-sm font-medium">{aiCommand.createTask.title}</div>
            </div>
                      {aiCommand.createTask.description && (
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Description</label>
                          <div className="text-sm text-muted-foreground">{aiCommand.createTask.description}</div>
          </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        {aiCommand.createTask.priority && (
                          <div className="flex items-center gap-2">
                            <Circle className={`h-2 w-2 fill-current ${
                              aiCommand.createTask.priority === 'high' 
                                ? 'text-red-500'
                                : aiCommand.createTask.priority === 'medium'
                                ? 'text-yellow-500'
                                : 'text-gray-400'
                            }`} />
                            <span className="text-xs text-muted-foreground">
                              {aiCommand.createTask.priority} priority
                            </span>
                          </div>
                        )}
                        {aiCommand.createTask.dueDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(aiCommand.createTask.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Multiple tasks preview */}
                  {aiCommand.createTasks && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {aiCommand.createTasks.map((task, index) => (
                        <div key={index} className="p-2 border rounded bg-background/50">
                          <div className="font-medium text-sm">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-1">
              <button
                      onClick={() => executeAICommand()}
                      className="px-3 py-1.5 text-xs border rounded hover:bg-muted transition-colors"
                    >
                      Create {aiCommand.createTasks ? `${aiCommand.createTasks.length} Tasks` : 'Task'}
              </button>
              <button
                      onClick={() => {
                        setAiCommand(null)
                        setSearchQuery('')
                      }}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
              </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Command confirmation */}
            {commandMode && (
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2">
                  {commandMode.confirmation}
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
                  {commandMode.targets.slice(0, 5).map(task => (
                    <p key={task.id} className="text-xs text-orange-600 dark:text-orange-400">
                      • {task.title}
                    </p>
                  ))}
                  {commandMode.targets.length > 5 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      • ... and {commandMode.targets.length - 5} more
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
              <button
                    onClick={() => executeCommand()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded transition-colors"
                  >
                    Yes, {commandMode.command === 'delete' ? 'Delete' : 'Complete'}
                  </button>
                  <button
                    onClick={() => {
                      setCommandMode(null)
                      setSearchQuery('')
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Beautiful Filters */}
          <div className="space-y-3 mb-6">
            {/* View selector with count */}
            <div className="flex items-center justify-between">
              <div className="relative">
                <button
                  onClick={() => setShowViewDropdown(!showViewDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-background border border-border rounded hover:border-foreground/20 transition-all"
                >
                  <Circle className="h-2 w-2 fill-current" />
                  <span>
                    {viewMode === 'all' && 'All tasks'}
                    {viewMode === 'assigned' && 'Assigned to me'}
                    {viewMode === 'created' && 'Created by me'}
                    {viewMode === 'shared' && 'Shared with me'}
                    {viewMode === 'team' && 'Team tasks'}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ml-1 ${showViewDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showViewDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowViewDropdown(false)}
                    />
                    <div className="absolute top-full left-0 mt-1.5 bg-background border rounded shadow-md overflow-hidden z-20 min-w-[200px]">
                      {[
                        { value: 'all', label: 'All tasks' },
                        { value: 'assigned', label: 'Assigned to me' },
                        { value: 'created', label: 'Created by me' },
                        { value: 'shared', label: 'Shared with me' },
                        { value: 'team', label: 'Team tasks' }
                      ].map((option, index) => (
                        <button
                          key={option.value}
                          onClick={() => { 
                            setViewMode(option.value as any)
                            setShowViewDropdown(false) 
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                            viewMode === option.value ? 'bg-muted/50' : ''
                          }`}
                        >
                          <Circle className={`h-1.5 w-1.5 ${viewMode === option.value ? 'fill-current' : ''}`} />
                          <span className={viewMode === option.value ? 'font-medium' : ''}>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground">
                {visibleTasks.length}
              </div>
            </div>

            {/* Time filters - elegant pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 'today', label: 'Today' },
                { value: 'tomorrow', label: 'Tomorrow' },
                { value: 'week', label: 'This week' },
                { value: 'expired', label: 'Overdue' },
                { value: 'no-date', label: 'No date' },
                { value: 'completed', label: 'Done' }
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => toggleFilter('time', filter.value as TimeFilter)}
                  className={`px-2.5 py-1 text-xs rounded border transition-all ${
                    filters.time.includes(filter.value as TimeFilter)
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background border-border hover:border-foreground/50'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              
              {filters.time.length > 0 && (
                <button
                  onClick={() => setFilters({ time: [] })}
                  className="px-2.5 py-1 text-xs rounded text-muted-foreground hover:text-foreground transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notification Onboarding */}
          {showNotificationOnboarding && (
            <div className="mb-6">
              <NotificationSetup 
                isOnboarding={true}
                onComplete={() => {
                  setShowNotificationOnboarding(false)
                  fetchWhatsAppSettings()
                }}
              />
            </div>
          )}

          {/* Task List */}
          <TaskList
            tasks={visibleTasks}
            onUpdate={fetchTasks}
            showAllTasks={showAllTasks}
            onShowAllTasksChange={setShowAllTasks}
            searchQuery={searchQuery}
            searchCompleted={searchCompleted}
            isSearching={isSearching}
          />

          {/* Footer */}
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t">
            <div className="flex items-center justify-center gap-3 md:gap-6 text-xs text-muted-foreground">
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
                onClick={() => setShowOrganization(true)}
                className="hover:text-foreground"
              >
                Organization
              </button>
              <button
                onClick={() => setShowIntegrations(true)}
                className="hover:text-foreground"
              >
                Integrations
              </button>
              <button
                onClick={() => setShowHowItWorks(true)}
                className="hover:text-foreground"
              >
                How it works
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hover:text-foreground"
              >
                Sign out
              </button>
            </div>
            
            {/* Timezone indicator */}
            <div className="mt-4 flex justify-center">
              <CompactTimezoneIndicator selectedTimezone={timezone} />
            </div>
          </div>
        </div>
      </div>

      {/* Removed - each drawer handles its own backdrop */}

      {/* Drawers */}
      <SettingsDrawer
        show={showSettings}
        onClose={() => setShowSettings(false)}
        organization={organization}
        agentEmail={agentEmail}
        timezone={timezone}
        onTimezoneChange={handleTimezoneChange}
        timezoneLoading={timezoneLoading}
        onShowNotifications={() => {
                        setShowNotifications(true)
                        fetchWhatsAppSettings()
                      }}
      />

      <IntegrationsDrawer
        show={showIntegrations}
        onClose={() => setShowIntegrations(false)}
        discordConnected={discordConnectedUI}
        discordUsername={discordUsernameUI}
        onDiscordConnect={handleDiscordConnect}
        onDiscordDisconnect={handleDiscordDisconnect}
        onNewApiKey={(key) => {
          setNewApiKey(key)
          setShowApiKeyModal(true)
        }}
      />

      <NotificationsDrawer
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
        onComplete={() => fetchWhatsAppSettings()}
        timezone={timezone}
        onTimezoneChange={handleTimezoneChange}
      />

      {/* API Key Modal */}
      {showApiKeyModal && newApiKey && (
        <ApiKeyModal
          apiKey={newApiKey}
          onClose={() => {
              setShowApiKeyModal(false)
              setNewApiKey("")
            }}
          />
      )}

      {/* How It Works Drawer */}
      <HowItWorksDrawer
        show={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      {/* Organization Drawer */}
      <OrganizationDrawer
        show={showOrganization}
        onClose={() => setShowOrganization(false)}
        onOrganizationUpdate={fetchOrganization}
      />
    </>
  )
}
