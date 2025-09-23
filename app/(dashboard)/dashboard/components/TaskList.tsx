"use client"

import { useSession } from "next-auth/react"
import { formatDateTime } from "@/lib/utils"
import { recordInteraction } from "@/lib/tasks"
import { 
  ArrowDownToLine, Share2, Eye, User, Pencil, Clock, MoreVertical, Trash2, CheckCircle 
} from "lucide-react"
import { Task } from "./types"
import { toast } from "@/hooks/use-toast"
import { showConfirm } from "@/components/global-modal"
import { useRef, useEffect, useState } from "react"
import { addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, format } from 'date-fns'

interface TaskListProps {
  tasks: Task[]
  onUpdate: () => void
  showAllTasks: boolean
  onShowAllTasksChange: (show: boolean) => void
  searchQuery: string
  searchCompleted: boolean
  isSearching: boolean
}

export function TaskList({
  tasks,
  onUpdate,
  showAllTasks,
  onShowAllTasksChange,
  searchQuery,
  searchCompleted,
  isSearching,
}: TaskListProps) {
  const { data: session } = useSession()
  const [editingDueId, setEditingDueId] = useState<string | null>(null)
  const [editingDueValue, setEditingDueValue] = useState<string>("")
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [showHiddenTasks, setShowHiddenTasks] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [showActionsFor, setShowActionsFor] = useState<string | null>(null)

  // Calculate task age and staleness
  const getTaskAge = (task: Task) => {
    const now = new Date()
    const created = new Date(task.createdAt)
    const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    
    const daysSinceActivity = daysDiff
    
    return {
      daysOld: daysDiff,
      daysSinceActivity,
      isStale: daysSinceActivity > 30,
      isVeryStale: daysSinceActivity > 60,
      isHidden: daysSinceActivity > 90 && !showHiddenTasks
    }
  }

  const getTaskFadeClass = (task: Task) => {
    const age = getTaskAge(task)
    
    if (age.isHidden) return 'hidden'
    if (age.isVeryStale) return 'opacity-40 hover:opacity-60'
    if (age.isStale) return 'opacity-60 hover:opacity-80'
    if (age.daysSinceActivity > 7) return 'opacity-80 hover:opacity-100'
    return ''
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (response.ok) {
        onUpdate()
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
        onUpdate()
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

  const toLocalInputValue = (iso: string): string => {
    try {
      const d = new Date(iso)
      const pad = (n: number) => String(n).padStart(2, '0')
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth() + 1)
      const dd = pad(d.getDate())
      const hh = pad(d.getHours())
      const mi = pad(d.getMinutes())
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
    } catch {
      return ''
    }
  }

  const openDueEditor = (task: Task) => {
    if (!task.dueDate) return
    setEditingDueId(task.id)
    setEditingDueValue(toLocalInputValue(task.dueDate))
  }

  const submitDueEditor = async (taskId: string) => {
    try {
      if (!editingDueValue) return
      const d = new Date(editingDueValue)
      if (isNaN(d.getTime())) {
        toast({ title: 'Invalid date/time', variant: 'error' })
        return
      }
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: d.toISOString() })
      })
      if (res.ok) {
        onUpdate()
        setEditingDueId(null)
        setEditingDueValue('')
        toast({ title: 'Due date updated!', variant: 'success' })
      }
    } catch {
      toast({ title: 'Failed to update', variant: 'error' })
    }
  }

  const CalendarPopup = ({ value, onChange, onSave, onCancel }: {
    value: string
    onChange: (v: string) => void
    onSave: () => void
    onCancel: () => void
  }) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const today = new Date()
    const weekStart = startOfWeek(calendarMonth, { weekStartsOn: 1 })
    const monthStart = startOfMonth(calendarMonth)
    const monthEnd = endOfMonth(calendarMonth)
    const days: Date[] = []
    for (let d = weekStart; d <= monthEnd || days.length % 7 !== 0; d = addDays(d, 1)) {
      days.push(new Date(d))
    }
    
    const choosePreset = (preset: string) => {
      const now = new Date()
      let chosen: Date
      switch (preset) {
        case 'today':
          chosen = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0)
          break
        case 'tomorrow':
          chosen = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0)
          break
        case 'nextWeek':
          chosen = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9, 0)
          break
        case 'nextMonth':
          chosen = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 9, 0)
          break
        default:
          return
      }
      onChange(toLocalInputValue(chosen.toISOString()))
    }

    const selectDate = (date: Date) => {
      const currentValue = value ? new Date(value) : new Date()
      const hours = currentValue.getHours()
      const minutes = currentValue.getMinutes()
      const combined = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
      onChange(toLocalInputValue(combined.toISOString()))
    }

    useEffect(() => {
      inputRef.current?.focus()
    }, [])

    return (
      <div className="absolute left-0 top-8 z-50 bg-background border rounded-lg shadow-lg p-3 w-72 md:w-80">
        <div className="flex flex-wrap gap-1 mb-2">
          <button onClick={() => choosePreset('today')} className="px-2 py-1 text-xs border rounded hover:bg-muted">Today 5pm</button>
          <button onClick={() => choosePreset('tomorrow')} className="px-2 py-1 text-xs border rounded hover:bg-muted">Tomorrow 9am</button>
          <button onClick={() => choosePreset('nextWeek')} className="px-2 py-1 text-xs border rounded hover:bg-muted">Next week</button>
          <button onClick={() => choosePreset('nextMonth')} className="px-2 py-1 text-xs border rounded hover:bg-muted">Next month</button>
        </div>
        <div className="mb-2">
          <div className="flex justify-between items-center mb-2">
            <button
              onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
              className="px-2 py-1 text-xs hover:bg-muted rounded"
            >
              ←
            </button>
            <div className="text-xs font-medium">{format(calendarMonth, 'MMMM yyyy')}</div>
            <button
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="px-2 py-1 text-xs hover:bg-muted rounded"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-xs">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <div key={d} className="text-center py-1 font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((d, i) => (
              <button
                key={i}
                onClick={() => selectDate(d)}
                className={`text-center py-1 hover:bg-muted rounded ${
                  isSameMonth(d, monthStart) ? '' : 'opacity-30'
                } ${isSameDay(d, today) ? 'bg-muted font-bold' : ''}`}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
        </div>
        <input
          ref={inputRef}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 text-xs border rounded mb-2"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-2 py-1 text-xs border rounded hover:bg-muted">Cancel</button>
          <button onClick={onSave} className="px-2 py-1 text-xs rounded bg-black text-white hover:bg-black/90">Save</button>
        </div>
      </div>
    )
  }

  const hiddenTaskCount = tasks.filter(t => t.status !== 'done').length - (showAllTasks ? 0 : Math.min(5, tasks.length))
  const staleHiddenCount = tasks.filter(task => {
    const age = getTaskAge(task)
    return age.isHidden && task.status !== 'done'
  }).length

  return (
    <div className="space-y-2 md:space-y-3">
      {tasks.length === 0 ? (
        <div className="text-center py-8 md:py-12 border rounded-lg">
          <p className="text-sm text-muted-foreground">
            {searchQuery ? (
              isSearching ? "Searching..." : "No matching tasks found"
            ) : (
              "No tasks to show"
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {searchQuery ? (
              "Try a different search or clear the search to see all tasks"
            ) : (
              `Forward an email to create your first task`
            )}
          </p>
        </div>
      ) : (
        <>
          {tasks.map((task) => {
            const age = getTaskAge(task)
            if (age.isHidden) return null
            const isExpanded = expandedTaskId === task.id
            
            return (
              <div
                key={task.id}
                className={`relative p-3 md:p-4 border rounded-lg hover:bg-muted/30 transition-all duration-300 ${getTaskFadeClass(task)}`}
              >
                {/* Mobile actions menu - positioned absolute top-right */}
                <div className="md:hidden absolute top-2 right-2 z-10">
                  <button
                    onClick={() => setShowActionsFor(showActionsFor === task.id ? null : task.id)}
                    className="p-1.5 hover:bg-muted rounded-md"
                  >
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {showActionsFor === task.id && (
                    <div className="absolute right-0 top-8 z-20 bg-background border rounded-lg shadow-lg p-1 min-w-[120px]">
                      <button
                        onClick={() => {
                          const newStatus = task.status === 'done' ? 'pending' : 'done'
                          updateTaskStatus(task.id, newStatus)
                          recordInteraction(task.id, newStatus === 'done' ? 'complete' : 'click')
                          setShowActionsFor(null)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded flex items-center gap-2"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {task.status === 'done' ? 'Reopen' : 'Complete'}
                      </button>
                      <button
                        onClick={() => {
                          deleteTask(task.id)
                          setShowActionsFor(null)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded text-destructive flex items-center gap-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Main content area - add padding-right on mobile to avoid overlap with menu */}
                <div className="space-y-2 pr-8 md:pr-0">
                  {/* Task Relationship Indicators */}
                  {(task.assignedByEmail || task.taskType === 'tracking' || task.taskType === 'delegation' || 
                    task.taskType === 'assigned') && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px] md:text-xs">
                      {/* Show who requested/assigned this task */}
                      {task.assignedByEmail && 
                       task.assignedByEmail !== session?.user?.email && 
                       !task.assignedByEmail.includes('@') && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          from {task.assignedByEmail}
                        </span>
                      )}
                      
                      {/* Show actual email sender */}
                      {task.assignedByEmail && 
                       task.assignedByEmail.includes('@') && 
                       task.assignedByEmail !== session?.user?.email && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          from {task.assignedByEmail.split('@')[0]}
                        </span>
                      )}
                      
                      {/* Task type indicators */}
                      {task.taskType === 'assigned' && task.userRole === 'executor' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                          <ArrowDownToLine className="h-3 w-3" />
                          <span className="hidden md:inline">assigned to me</span>
                          <span className="md:hidden">assigned</span>
                        </span>
                      )}
                      
                      {task.taskType === 'self' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          <User className="h-3 w-3" />
                          self
                        </span>
                      )}
                      
                      {task.taskType === 'delegation' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                          <Share2 className="h-3 w-3" />
                          <span className="hidden md:inline">to delegate</span>
                          <span className="md:hidden">delegate</span>
                        </span>
                      )}
                      
                      {task.taskType === 'tracking' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          <span className="hidden md:inline">monitoring</span>
                          <span className="md:hidden">watch</span>
                        </span>
                      )}
                      
                      {/* Assignment target */}
                      {task.assignedToEmail && 
                       task.assignedToEmail !== session?.user?.email && 
                       (session?.user?.organizationSlug && !task.assignedToEmail.includes(session.user.organizationSlug)) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                          for {task.assignedToEmail.split('@')[0]}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Task title and actions row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 
                          className="text-sm font-medium flex-1 cursor-pointer"
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                          <span className={isExpanded ? "" : "line-clamp-2"}>{task.title}</span>
                        </h3>
                        {age.isStale && (
                          <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0">
                            stale
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Desktop action buttons */}
                    <div className="hidden md:flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newStatus = task.status === 'done' ? 'pending' : 'done'
                          updateTaskStatus(task.id, newStatus)
                          recordInteraction(task.id, newStatus === 'done' ? 'complete' : 'click')
                        }}
                        className="text-xs px-2 py-1 border rounded hover:bg-muted"
                      >
                        {task.status === 'done' ? 'Reopen' : 'Complete'}
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  {/* Description (expandable on mobile) */}
                  {task.description && (
                    <div 
                      className={`text-xs text-muted-foreground ${
                        isExpanded ? '' : 'line-clamp-2 md:line-clamp-3'
                      }`}
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    >
                      {task.description}
                    </div>
                  )}
                  
                  {/* Meta line */}
                  {(task.relevanceReason || task.priority === 'high') && (
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground">
                      {task.relevanceReason && (
                        <span className="font-medium">{task.relevanceReason}</span>
                      )}
                      {task.priority === 'high' && (
                        <span className="text-red-600">High priority</span>
                      )}
                    </div>
                  )}

                  {/* Source line */}
                  {task.createdVia === 'email' && task.emailMetadata?.from && (
                    <div className="text-[10px] md:text-xs text-muted-foreground">
                      {(() => {
                        const raw = String(task.emailMetadata.from)
                        const match = raw.match(/<(.+?)>/)
                        const addr = (match ? match[1] : raw).toLowerCase()
                        return <span>via email from {addr}</span>
                      })()}
                    </div>
                  )}

                  {/* Tags line */}
                  {task.emailMetadata?.smartAnalysis?.tags && (
                    <div className="flex flex-wrap gap-1.5 md:gap-2 text-[10px] md:text-xs text-muted-foreground">
                      {/* Expired pill */}
                      {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && (
                        <span className="px-1.5 md:px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                          Expired
                        </span>
                      )}
                      {/* Due date pill - click to edit */}
                      {task.dueDate && (
                        <>
                          {editingDueId === task.id ? (
                            <div>
                              <CalendarPopup
                                value={editingDueValue}
                                onChange={(v) => setEditingDueValue(v)}
                                onSave={() => submitDueEditor(task.id)}
                                onCancel={() => { setEditingDueId(null); setEditingDueValue('') }}
                              />
                            </div>
                          ) : (
                            <span
                              className="px-1.5 md:px-2 py-0.5 border border-dashed rounded bg-transparent cursor-pointer hover:bg-muted inline-flex items-center gap-1"
                              title="Click to edit date and time"
                              aria-label="Edit date and time"
                              onClick={() => openDueEditor(task)}
                            >
                              {formatDateTime(task.dueDate)}
                              <Pencil className="h-2.5 md:h-3 w-2.5 md:w-3 opacity-60" />
                            </span>
                          )}
                        </>
                      )}
                      {/* Other tags */}
                      {task.emailMetadata.smartAnalysis.tags.where && (
                        <span className="px-1.5 md:px-2 py-0.5 border rounded truncate max-w-[100px] md:max-w-none">
                          {task.emailMetadata.smartAnalysis.tags.where}
                        </span>
                      )}
                      {task.emailMetadata.smartAnalysis.tags.who && (
                        <span className="px-1.5 md:px-2 py-0.5 border rounded truncate max-w-[100px] md:max-w-none">
                          {task.emailMetadata.smartAnalysis.tags.who}
                        </span>
                      )}
                      {task.emailMetadata.smartAnalysis.tags.what && (
                        <span className="px-1.5 md:px-2 py-0.5 border rounded truncate max-w-[100px] md:max-w-none">
                          {task.emailMetadata.smartAnalysis.tags.what}
                        </span>
                      )}
                      {Array.isArray(task.emailMetadata.smartAnalysis.tags.extras) &&
                        task.emailMetadata.smartAnalysis.tags.extras.slice(0, 2).map((ex: string, idx: number) => (
                          <span key={idx} className="px-1.5 md:px-2 py-0.5 border rounded max-w-[80px] md:max-w-[200px] truncate">
                            {ex}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          {/* Show more button */}
          {hiddenTaskCount > 0 && !searchQuery && (
            <button
              onClick={() => onShowAllTasksChange(!showAllTasks)}
              className="w-full py-2 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllTasks ? (
                <>↑ Show less</>
              ) : (
                <>↓ {hiddenTaskCount} more {hiddenTaskCount === 1 ? 'task' : 'tasks'}</>
              )}
            </button>
          )}
          
          {/* Show hidden stale tasks toggle */}
          {staleHiddenCount > 0 && (
            <button
              onClick={() => setShowHiddenTasks(!showHiddenTasks)}
              className="w-full py-2 text-[10px] md:text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="h-3 w-3" />
              {showHiddenTasks 
                ? 'Hide stale tasks' 
                : `${staleHiddenCount} stale task${staleHiddenCount > 1 ? 's' : ''} hidden (90+ days old)`
              }
            </button>
          )}
        </>
      )}
    </div>
  )
}