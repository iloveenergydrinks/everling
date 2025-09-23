"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Users, Building2, Mail, Key, Database, Trash2, 
  Edit, CheckCircle, XCircle, Search, RefreshCw,
  Send, Shield, Lock
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface User {
  id: string
  email: string
  name: string | null
  emailVerified: Date | null
  phoneNumber?: string | null
  createdAt: string
  organization?: {
    id: string
    name: string
    slug: string
  }
  organizations?: Array<{
    id: string
    name: string
    slug: string
  }>
  stats?: {
    tasksCreated: number
    tasksAssigned: number
    apiKeys: number
  }
}

interface Organization {
  id: string
  name: string
  slug: string
  tasksCreated: number
  taskLimit: number
  createdAt: string
  _count?: {
    members: number
    tasks: number
    emailLogs: number
    allowedEmails: number
  }
  adminEmails?: string[]
  members?: Array<{
    user: {
      email: string
      name: string | null
    }
    role: string
  }>
}

interface EmailLog {
  id: string
  fromEmail: string
  toEmail: string
  subject: string
  processed: boolean
  taskId: string | null
  createdAt: string
  error?: string
  organization?: {
    name: string
    slug: string
  }
}

interface ApiKey {
  id: string
  name: string
  keyHint: string
  lastUsed: Date | null
  createdAt: string
  user?: {
    email: string
  }
}

interface AllowedEmail {
  id: string
  email: string
  note: string | null
  createdAt: string
  organization: {
    id: string
    name: string
    slug: string
  }
  addedBy?: {
    email: string
  }
}

// Admin emails that have access to this dashboard
const ADMIN_EMAILS = [
  "martino.fabbro@gmail.com",
  "olmo93@hotmail.it",
  // Add more admin emails here
]

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Data states
  const [users, setUsers] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([])
  const [stats, setStats] = useState<any>(null)
  
  // Allowed emails management state
  const [selectedOrgForAllowed, setSelectedOrgForAllowed] = useState<string>('')
  const [newAllowedEmail, setNewAllowedEmail] = useState('')
  const [newAllowedNote, setNewAllowedNote] = useState('')
  const [addingAllowed, setAddingAllowed] = useState(false)

  // Check if user is admin
  useEffect(() => {
    if (status === "loading") return
    
    if (!session || !ADMIN_EMAILS.includes(session.user?.email || "")) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page",
        variant: "error"
      })
      router.push("/dashboard")
    }
  }, [session, status, router])

  // Fetch all data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, orgsRes, emailsRes, keysRes, statsRes, allowedRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/organizations"),
        fetch("/api/admin/emails"),
        fetch("/api/admin/keys"),
        fetch("/api/admin/stats"),
        fetch("/api/allowed-emails")
      ])

      if (usersRes.ok) setUsers(await usersRes.json())
      if (orgsRes.ok) setOrganizations(await orgsRes.json())
      if (emailsRes.ok) setEmailLogs(await emailsRes.json())
      if (keysRes.ok) setApiKeys(await keysRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
      if (allowedRes.ok) {
        const allowedData = await allowedRes.json()
        // Transform data to include organization info
        const transformedAllowed = allowedData.map((item: any) => {
          const org = organizations.find(o => o.id === item.organizationId)
          return {
            ...item,
            organization: org || { id: item.organizationId, name: 'Unknown', slug: 'unknown' }
          }
        })
        setAllowedEmails(transformedAllowed)
      }
    } catch (error) {
      console.error("Error fetching admin data:", error)
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session && ADMIN_EMAILS.includes(session.user?.email || "")) {
      fetchData()
    }
  }, [session])

  // Verify user email
  const verifyUserEmail = async (userId: string, email: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: "POST"
      })

      if (res.ok) {
        toast({
          title: "Email verified",
          description: `${email} has been verified`,
          variant: "success"
        })
        fetchData()
      } else {
        throw new Error("Failed to verify email")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify email",
        variant: "error"
      })
    }
  }

  // Send password reset
  const sendPasswordReset = async (email: string) => {
    try {
      const res = await fetch(`/api/admin/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })

      if (res.ok) {
        toast({
          title: "Password reset sent",
          description: `Password reset link sent to ${email}`,
          variant: "success"
        })
      } else {
        throw new Error("Failed to send reset")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send password reset",
        variant: "error"
      })
    }
  }

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This will also delete all their data.")) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast({
          title: "User deleted",
          description: "User and all associated data have been deleted",
          variant: "success"
        })
        fetchData()
      } else {
        throw new Error("Failed to delete user")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "error"
      })
    }
  }

  // Update organization task limit
  const updateTaskLimit = async (orgId: string, currentLimit: number) => {
    const newLimitStr = prompt(`Enter new task limit (current: ${currentLimit}):`, currentLimit.toString())
    
    if (!newLimitStr) return
    
    const newLimit = parseInt(newLimitStr)
    if (isNaN(newLimit) || newLimit < 0) {
      toast({
        title: "Invalid limit",
        description: "Please enter a valid positive number",
        variant: "error"
      })
      return
    }

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskLimit: newLimit })
      })

      if (res.ok) {
        toast({
          title: "Task limit updated",
          description: `Task limit set to ${newLimit}`,
          variant: "success"
        })
        fetchData()
      } else {
        throw new Error("Failed to update task limit")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task limit",
        variant: "error"
      })
    }
  }

  // Delete organization
  const deleteOrganization = async (orgId: string) => {
    if (!confirm("Are you sure you want to delete this organization? This will delete ALL associated data including users, tasks, and emails.")) {
      return
    }

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast({
          title: "Organization deleted",
          description: "Organization and all associated data have been deleted",
          variant: "success"
        })
        fetchData()
      } else {
        throw new Error("Failed to delete organization")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete organization",
        variant: "error"
      })
    }
  }

  // Add allowed email
  const addAllowedEmail = async () => {
    if (!selectedOrgForAllowed || !newAllowedEmail) {
      toast({
        title: "Missing information",
        description: "Please select an organization and enter an email address",
        variant: "error"
      })
      return
    }

    setAddingAllowed(true)
    try {
      const res = await fetch(`/api/allowed-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrgForAllowed,
          email: newAllowedEmail,
          note: newAllowedNote || `Added by admin ${session?.user?.email}`
        })
      })

      if (res.ok) {
        toast({
          title: "Email added",
          description: `${newAllowedEmail} has been added to the allowed list`,
          variant: "success"
        })
        setNewAllowedEmail('')
        setNewAllowedNote('')
        fetchData()
      } else {
        const error = await res.json()
        throw new Error(error.error || "Failed to add email")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add allowed email",
        variant: "error"
      })
    } finally {
      setAddingAllowed(false)
    }
  }

  // Delete allowed email
  const deleteAllowedEmail = async (allowedId: string, email: string) => {
    if (!confirm(`Remove ${email} from allowed list?`)) {
      return
    }

    try {
      const res = await fetch(`/api/allowed-emails/${allowedId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast({
          title: "Email removed",
          description: `${email} has been removed from the allowed list`,
          variant: "success"
        })
        fetchData()
      } else {
        throw new Error("Failed to remove email")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove allowed email",
        variant: "error"
      })
    }
  }

  // Filter data based on search - now includes organization names for users
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.phoneNumber?.includes(searchTerm) ||
      user.organizations?.some(org => 
        org.name.toLowerCase().includes(searchLower) ||
        org.slug.toLowerCase().includes(searchLower)
      )
    )
  })

  const filteredOrgs = organizations.filter(org => {
    const searchLower = searchTerm.toLowerCase()
    return (
      org.name.toLowerCase().includes(searchLower) ||
      org.slug.toLowerCase().includes(searchLower) ||
      org.adminEmails?.some(email => email.toLowerCase().includes(searchLower))
    )
  })

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!ADMIN_EMAILS.includes(session.user?.email || "")) {
    return null
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Global Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide administration - All users, all organizations</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.totalUsers}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.verifiedUsers} verified
                    <span className="text-green-600 ml-1">({stats.verificationRate}%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.totalOrganizations}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.activeOrgs} active
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.totalTasks}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.totalApiKeys} API keys
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Email Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{stats.totalEmails}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Success: <span className="text-green-600">{stats.emailSuccessRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Search and Refresh */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users, organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="organizations">Organizations ({organizations.length})</TabsTrigger>
          <TabsTrigger value="allowed">Allowed Emails ({allowedEmails.length})</TabsTrigger>
          <TabsTrigger value="emails">Email Logs ({emailLogs.length})</TabsTrigger>
          <TabsTrigger value="keys">API Keys ({apiKeys.length})</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4 border rounded hover:bg-muted/50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {user.name || "No name"} 
                          {user.phoneNumber && ` • ${user.phoneNumber}`}
                        </p>
                        
                        {/* Show all organizations */}
                        <div className="text-xs text-muted-foreground mt-1">
                          Organizations: 
                          {user.organizations && user.organizations.length > 0 ? (
                            <span className="ml-1">
                              {user.organizations.map((org, idx) => (
                                <span key={org.id}>
                                  {idx > 0 && ", "}
                                  <span className="font-medium">{org.name}</span> ({org.slug})
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="ml-1 text-red-500">No organization</span>
                          )}
                        </div>
                        
                        {/* User stats */}
                        {user.stats && (
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            <span>📝 {user.stats.tasksCreated} tasks</span>
                            <span>🔑 {user.stats.apiKeys} API keys</span>
                            <span>📋 {user.stats.tasksAssigned} assigned</span>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined: {new Date(user.createdAt).toLocaleDateString()} 
                          {" "}({Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days ago)
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {user.emailVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="h-3 w-3" />
                              Email verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                              <XCircle className="h-3 w-3" />
                              Email not verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-3 border-t">
                      {!user.emailVerified && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyUserEmail(user.id, user.email)}
                          className="text-xs"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Verify Email
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Send password reset email to ${user.email}?`)) {
                            sendPasswordReset(user.email)
                          }
                        }}
                        className="text-xs"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Send Password Reset
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
                            deleteUser(user.id)
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete User
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations">
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Manage all organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredOrgs.map((org) => (
                  <div key={org.id} className="p-4 border rounded hover:bg-muted/50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{org.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Email: <span className="font-medium">{org.slug}@everling.io</span>
                        </p>
                        
                        {/* Admin emails */}
                        {org.adminEmails && org.adminEmails.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Admins: {org.adminEmails.join(", ")}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {org._count?.members || 0} members
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {org._count?.tasks || 0} tasks
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {org._count?.emailLogs || 0} emails
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {org._count?.allowedEmails || 0} allowed
                          </span>
                        </div>
                        
                        <div className="text-xs mt-1">
                          <span className={`inline-flex items-center gap-1 ${
                            org.tasksCreated >= org.taskLimit ? 'text-red-600' : 'text-muted-foreground'
                          }`}>
                            Task usage: {org.tasksCreated} / {org.taskLimit} limit
                            {org.tasksCreated >= org.taskLimit && ' ⚠️ LIMIT REACHED'}
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-1">
                          Created: {new Date(org.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateTaskLimit(org.id, org.taskLimit)}
                        className="text-xs"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Update Task Limit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${org.name}"?\n\nThis will permanently delete:\n• All ${org._count?.members || 0} members\n• All ${org._count?.tasks || 0} tasks\n• All ${org._count?.emailLogs || 0} email logs\n\nThis action cannot be undone.`)) {
                            deleteOrganization(org.id)
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete Organization
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allowed Emails Tab */}
        <TabsContent value="allowed">
          <Card>
            <CardHeader>
              <CardTitle>Allowed Email Management</CardTitle>
              <CardDescription>Manage allowed email senders for all organizations</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add new allowed email form */}
              <div className="border rounded-lg p-4 mb-6">
                <h3 className="font-medium text-sm mb-3">Add Allowed Email</h3>
                <div className="space-y-3">
                  {/* Organization selector */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Select Organization</label>
                    <select
                      value={selectedOrgForAllowed}
                      onChange={(e) => setSelectedOrgForAllowed(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Select Organization --</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.slug}@everling.io)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick fill for Laura */}
                  {selectedOrgForAllowed && organizations.find(o => o.id === selectedOrgForAllowed)?.slug === 'antoniacomilaura' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-xs text-yellow-800 font-medium mb-2">Quick Add for Laura Antoniacomi</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewAllowedEmail('antoniacomi.laura@gmail.com')
                          setNewAllowedNote('Laura - organization owner')
                        }}
                        className="text-xs"
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Fill: antoniacomi.laura@gmail.com
                      </Button>
                    </div>
                  )}

                  {/* Email input */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Email Address</label>
                    <Input
                      type="email"
                      value={newAllowedEmail}
                      onChange={(e) => setNewAllowedEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="text-sm"
                    />
                  </div>

                  {/* Note input */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Note (optional)</label>
                    <Input
                      value={newAllowedNote}
                      onChange={(e) => setNewAllowedNote(e.target.value)}
                      placeholder="e.g., Team member, Client, etc."
                      className="text-sm"
                    />
                  </div>

                  {/* Add button */}
                  <Button
                    onClick={addAllowedEmail}
                    disabled={!selectedOrgForAllowed || !newAllowedEmail || addingAllowed}
                    className="w-full"
                  >
                    {addingAllowed ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Add to Allowed List
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Allowed emails list */}
              <div className="space-y-2">
                {allowedEmails.map((allowed) => (
                  <div key={allowed.id} className="p-4 border rounded hover:bg-muted/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{allowed.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Organization: <span className="font-medium">{allowed.organization.name}</span> ({allowed.organization.slug})
                        </p>
                        {allowed.note && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Note: {allowed.note}
                          </p>
                        )}
                        {allowed.addedBy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Added by: {allowed.addedBy.email}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Added: {new Date(allowed.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteAllowedEmail(allowed.id, allowed.email)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {allowedEmails.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No allowed emails configured yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Logs Tab */}
        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Global Email Activity</CardTitle>
              <CardDescription>Last 200 emails across all organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {emailLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-sm hover:bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{log.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        From: {log.fromEmail} → To: {log.toEmail}
                      </p>
                      {log.organization && (
                        <p className="text-xs text-muted-foreground">
                          Organization: <span className="font-medium">{log.organization.name}</span> ({log.organization.slug})
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      {log.error && (
                        <p className="text-xs text-red-600">Error: {log.error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {log.processed && log.taskId ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : log.error ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-yellow-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>All generated API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 border rounded-sm hover:bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Key: {key.keyHint}... • User: {key.user?.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(key.createdAt).toLocaleDateString()} • 
                        Last used: {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <Key className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
