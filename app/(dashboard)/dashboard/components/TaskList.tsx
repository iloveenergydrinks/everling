"use client"

import { useSession } from "next-auth/react"
import { formatDateTime } from "@/lib/utils"
import { recordInteraction } from "@/lib/tasks"
import { 
  ArrowDownToLine, Share2, Eye, User, Pencil, Clock 
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
        body: JSON.stringify({ dueDate: d.toISOString(), reminderDate: d.toISOString() })
      })
      if (res.ok) {
        toast({ title: 'Date updated', description: 'Due and reminder updated', variant: 'success' })
        setEditingDueId(null)
        setEditingDueValue("")
        onUpdate()
      }
    } catch (e) {
      console.error('Update date error:', e)
    }
  }

  const CalendarPopup = ({
    value,
    onChange,
    onSave,
    onCancel
  }: {
    value: string
    onChange: (val: string) => void
    onSave: () => void
    onCancel: () => void
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
      const handleOutside = (e: MouseEvent | TouchEvent) => {
        const el = containerRef.current
        if (!el) return
        if (e.target instanceof Node && !el.contains(e.target)) {
          onSave()
        }
      }
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('touchstart', handleOutside)
      return () => {
        document.removeEventListener('mousedown', handleOutside)
        document.removeEventListener('touchstart', handleOutside)
      }
    }, [onSave])

    const base = value ? new Date(value) : new Date()
    const month = calendarMonth
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    const days: Date[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
    const hours = [8, 9, 10, 11, 14, 15, 16, 17]

    const setDay = (day: Date) => {
      const newDate = new Date(base)
      newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate())
      const iso = toLocalInputValue(newDate.toISOString())
      onChange(iso)
    }
    const setHour = (h: number) => {
      const newDate = value ? new Date(value) : new Date()
      newDate.setHours(h, 0, 0, 0)
      const iso = toLocalInputValue(newDate.toISOString())
      onChange(iso)
    }

    return (
      <div ref={containerRef} className="mt-1 p-3 border rounded bg-background shadow-sm text-xs">
        <div className="flex items-center justify-between mb-2">
          <button className="px-2 py-1 border rounded" onClick={() => setCalendarMonth(addMonths(month, -1))}>←</button>
          <div className="font-medium">{format(month, 'MMMM yyyy')}</div>
          <button className="px-2 py-1 border rounded" onClick={() => setCalendarMonth(addMonths(month, 1))}>→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} className="text-center text-muted-foreground">{d}</div>
          ))}
          {days.map((day, idx) => {
            const selected = value ? isSameDay(day, new Date(value)) : false
            const outside = !isSameMonth(day, month)
            return (
              <button
                key={idx}
                className={`h-7 rounded border ${selected ? 'bg-black text-white' : outside ? 'text-muted-foreground/50' : 'hover:bg-muted'}`}
                onClick={() => setDay(day)}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1">
          {hours.map(h => (
            <button
              key={h}
              onClick={() => setHour(h)}
              className="px-2 py-1 border rounded hover:bg-muted"
            >
              {String(h).padStart(2,'0')}:00
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
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
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <div className="text-center py-12 border rounded">
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
            
            return (
              <div
                key={task.id}
                className={`p-4 border rounded hover:bg-muted/30 transition-all duration-300 ${getTaskFadeClass(task)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Task Relationship Indicators */}
                    {(task.assignedByEmail || task.taskType === 'tracking' || task.taskType === 'delegation' || 
                      task.taskType === 'assigned') && (
                      <div className="flex flex-wrap items-center gap-1 mb-1.5">
                        {/* Show who requested/assigned this task */}
                        {task.assignedByEmail && 
                         task.assignedByEmail !== session?.user?.email && 
                         !task.assignedByEmail.includes('@') && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            from {task.assignedByEmail}
                          </span>
                        )}
                        
                        {/* Show actual email sender */}
                        {task.assignedByEmail && 
                         task.assignedByEmail.includes('@') && 
                         task.assignedByEmail !== session?.user?.email && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            from {task.assignedByEmail.split('@')[0]}
                          </span>
                        )}
                        
                        {/* Task type indicators */}
                        {task.taskType === 'assigned' && task.userRole === 'executor' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                            <ArrowDownToLine className="h-3 w-3" />
                            assigned to me
                          </span>
                        )}
                        
                        {task.taskType === 'self' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <User className="h-3 w-3" />
                            self
                          </span>
                        )}
                        
                        {task.taskType === 'delegation' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-orange-100/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400">
                            <Share2 className="h-3 w-3" />
                            to delegate
                          </span>
                        )}
                        
                        {task.taskType === 'tracking' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            monitoring
                          </span>
                        )}
                        
                        {/* Assignment target */}
                        {task.assignedToEmail && 
                         task.assignedToEmail !== session?.user?.email && 
                         (session?.user?.organizationSlug && !task.assignedToEmail.includes(session.user.organizationSlug)) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                            for {task.assignedToEmail.split('@')[0]}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Task title */}
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium truncate flex-1" title={task.title}>{task.title}</h3>
                      {age.isStale && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          stale
                        </span>
                      )}
                    </div>
                    
                    {/* Description */}
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
                    
                    {/* Meta line */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {task.relevanceReason && (
                        <span className="font-medium">{task.relevanceReason}</span>
                      )}
                      {task.priority === 'high' && (
                        <span className="text-red-600">High priority</span>
                      )}
                    </div>

                    {/* Source line */}
                    {task.createdVia === 'email' && task.emailMetadata?.from && (
                      <div className="mt-1 text-xs text-muted-foreground">
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
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {/* Expired pill */}
                        {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">Expired</span>
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
                                className="px-2 py-0.5 border border-dashed rounded bg-transparent cursor-pointer hover:bg-muted inline-flex items-center gap-1"
                                title="Click to edit date and time"
                                aria-label="Edit date and time"
                                onClick={() => openDueEditor(task)}
                              >
                                {formatDateTime(task.dueDate)}
                                <Pencil className="h-3 w-3 opacity-60" />
                              </span>
                            )}
                          </>
                        )}
                        {/* Other tags */}
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
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
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
              </div>
            )
          })}
          
          {/* Show more button */}
          {hiddenTaskCount > 0 && !searchQuery && (
            <button
              onClick={() => onShowAllTasksChange(!showAllTasks)}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
              className="w-full py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center justify-center gap-2"
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
