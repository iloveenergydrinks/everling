'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Loader2, Users, Settings, Send, UserPlus, Crown, User, Shield, Copy, Trash2, Building } from 'lucide-react'
import { DrawerWrapper } from './DrawerWrapper'

interface Organization {
  id: string
  name: string
  slug: string
  emailPrefix: string
  plan: string
  taskLimit: number
  monthlyTasksUsed: number
  createdAt: string
}

interface Member {
  id: string
  user: {
    id: string
    name: string | null
    email: string
    emailVerified: Date | null
  }
  role: string
  joinedAt: string
}

interface OrganizationDrawerProps {
  show: boolean
  onClose: () => void
}

export function OrganizationDrawer({ show, onClose }: OrganizationDrawerProps) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Organization data
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  
  // Members data
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)

  // Fetch data when drawer opens
  useEffect(() => {
    if (show) {
      fetchOrganizationData()
      fetchMembers()
    }
  }, [show])

  const fetchOrganizationData = async () => {
    try {
      const response = await fetch('/api/organization')
      if (response.ok) {
        const data = await response.json()
        setOrganization(data)
        setOrganizationName(data.name)
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
      toast({
        title: 'Error',
        description: 'Failed to load organization data',
        variant: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/organization/members')
      if (response.ok) {
        const data = await response.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const handleUpdateOrganization = async () => {
    if (!organizationName.trim()) {
      toast({
        title: 'Name required',
        description: 'Organization name cannot be empty',
        variant: 'error'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: organizationName.trim() })
      })

      if (response.ok) {
        const updated = await response.json()
        setOrganization(updated)
        toast({
          title: 'Success',
          description: 'Organization name updated',
          variant: 'success'
        })
      } else {
        throw new Error('Failed to update')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update organization',
        variant: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address',
        variant: 'error'
      })
      return
    }

    setInviting(true)
    try {
      const response = await fetch('/api/organization/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        })
      })

      if (response.ok) {
        toast({
          title: 'Invitation sent',
          description: `Invitation sent to ${inviteEmail}`,
          variant: 'success'
        })
        setInviteEmail('')
        fetchMembers() // Refresh members list
      } else {
        const error = await response.json()
        throw new Error(error.message || 'Failed to send invite')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'error'
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const response = await fetch(`/api/organization/members/${memberId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMembers(members.filter(m => m.user.id !== memberId))
        toast({
          title: 'Member removed',
          description: 'Member has been removed from the organization',
          variant: 'success'
        })
      } else {
        throw new Error('Failed to remove member')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'error'
      })
    }
  }

  const copyAgentEmail = () => {
    const email = `${organization?.emailPrefix}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`
    navigator.clipboard.writeText(email)
    toast({
      title: 'Copied!',
      description: 'Agent email copied to clipboard',
      variant: 'success'
    })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />
      case 'member':
        return <User className="h-4 w-4" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'member':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const canManageMembers = session?.user?.organizationRole === 'admin'

  return (
    <DrawerWrapper
      show={show}
      onClose={onClose}
      title="Organization"
      icon={<Building className="h-5 w-5" />}
    >
      <div className="p-4 md:p-6 overflow-y-auto h-full">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !organization ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">Organization not found</p>
          </div>
        ) : (
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="general" className="gap-2">
                  <Settings className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-2">
                  <Users className="h-4 w-4" />
                  Members {members.length > 0 && `(${members.length})`}
                </TabsTrigger>
                <TabsTrigger value="invites" className="gap-2">
                  <Send className="h-4 w-4" />
                  Invites
                </TabsTrigger>
              </TabsList>

              {/* General Settings Tab */}
              <TabsContent value="general" className="space-y-6">
                <div className="border rounded-md p-3 md:p-4">
                  <h3 className="font-medium text-sm mb-3">General Settings</h3>
                  
                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label htmlFor="org-name" className="text-xs">Organization Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="org-name"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Enter organization name"
                        className="rounded text-sm"
                        disabled={!canManageMembers}
                      />
                      {canManageMembers && (
                        <Button
                          onClick={handleUpdateOrganization}
                          disabled={saving || organizationName === organization.name}
                          className="rounded"
                          size="sm"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This name is displayed across the platform
                    </p>
                  </div>

                  {/* Agent Email */}
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs">Agent Email</Label>
                    <div className="flex items-center gap-2">
                      <code className="px-3 py-2 bg-muted rounded text-xs">
                        {organization.emailPrefix}@{process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyAgentEmail}
                        className="rounded"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Forward emails here to create tasks automatically
                    </p>
                  </div>

                  {/* Plan & Usage */}
                  <div className="space-y-2 mt-4">
                    <Label className="text-xs">Current Plan</Label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                          {organization.plan === 'pro' ? 'Pro' : 'Free'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {organization.plan === 'pro' 
                            ? 'Unlimited tasks' 
                            : `${organization.monthlyTasksUsed} / ${organization.taskLimit} tasks this month`}
                        </span>
                      </div>
                      {organization.plan === 'free' && (
                        <Button variant="outline" size="sm" className="rounded text-xs">
                          Upgrade to Pro
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members" className="space-y-4">
                <div className="border rounded-md p-3 md:p-4">
                  <h3 className="font-medium text-sm mb-3">Team Members</h3>
                  
                  {/* Members List */}
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.user.id}
                        className="flex items-center justify-between p-3 border rounded"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {member.user.name || member.user.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.user.email}
                            </div>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                            {getRoleIcon(member.role)}
                            {member.role}
                          </div>
                        </div>
                        
                        {canManageMembers && member.user.id !== session?.user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.user.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {members.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No members yet
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Invites Tab */}
              <TabsContent value="invites" className="space-y-4">
                <div className="border rounded-md p-3 md:p-4">
                  <h3 className="font-medium text-sm mb-3">Invite Team Members</h3>
                  
                  {canManageMembers ? (
                    <div className="space-y-4">
                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email" className="text-xs">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="rounded text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-role" className="text-xs">Role</Label>
                          <select
                            id="invite-role"
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="w-full h-9 px-3 rounded border bg-background text-sm"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleInviteMember}
                        disabled={inviting || !inviteEmail}
                        className="rounded w-full"
                        size="sm"
                      >
                        {inviting ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-3 w-3" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                      
                      <div className="pt-3 border-t">
                        <h4 className="font-medium text-xs mb-2">Role Permissions</h4>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <User className="h-3 w-3 mt-0.5" />
                            <div>
                              <span className="font-medium">Member:</span> Can create and manage tasks
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Crown className="h-3 w-3 mt-0.5" />
                            <div>
                              <span className="font-medium">Admin:</span> Full access to organization settings
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Only admins can invite new members
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DrawerWrapper>
  )
}
