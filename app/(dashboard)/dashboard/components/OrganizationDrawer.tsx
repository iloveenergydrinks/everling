'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DrawerWrapper } from './DrawerWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2, Crown, User, Shield, Copy, Trash2, ChevronDown, ChevronRight, UserPlus } from 'lucide-react'

interface OrganizationDrawerProps {
  show: boolean
  onClose: () => void
}

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

export function OrganizationDrawer({ show, onClose }: OrganizationDrawerProps) {
  const { data: session } = useSession()
  const [activeSection, setActiveSection] = useState<'general' | 'members' | 'invites' | null>('general')
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
        throw new Error(error.error || 'Failed to send invite')
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
        return <Crown className="h-3.5 w-3.5" />
      case 'member':
        return <User className="h-3.5 w-3.5" />
      default:
        return <Shield className="h-3.5 w-3.5" />
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
    >
      <div className="p-3 md:p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* General Section */}
            <div className="border rounded-md p-3 md:p-4">
              <button
                onClick={() => setActiveSection(activeSection === 'general' ? null : 'general')}
                className="w-full flex items-center justify-between text-sm font-medium mb-3"
              >
                <span>General Settings</span>
                {activeSection === 'general' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              
              {activeSection === 'general' && (
                <div className="space-y-4">
                  {/* Organization Name */}
                  <div className="space-y-2">
                    <Label htmlFor="org-name" className="text-xs">Organization Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="org-name"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Enter organization name"
                        className="text-sm rounded"
                        disabled={!canManageMembers}
                      />
                      {canManageMembers && (
                        <Button
                          onClick={handleUpdateOrganization}
                          disabled={saving || organizationName === organization?.name}
                          size="sm"
                          className="rounded"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                  <div className="space-y-2">
                    <Label className="text-xs">Agent Email</Label>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1.5 bg-muted rounded text-xs">
                        {organization?.emailPrefix}@{process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyAgentEmail}
                        className="h-7 w-7 p-0"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Forward emails here to create tasks
                    </p>
                  </div>

                  {/* Plan & Usage */}
                  <div className="space-y-2">
                    <Label className="text-xs">Current Plan</Label>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                        {organization?.plan === 'pro' ? 'Pro' : 'Free'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {organization?.plan === 'pro' 
                          ? 'Unlimited tasks' 
                          : `${organization?.monthlyTasksUsed} / ${organization?.taskLimit} tasks this month`}
                      </span>
                    </div>
                    {organization?.plan === 'free' && (
                      <Button variant="outline" size="sm" className="text-xs rounded">
                        Upgrade to Pro
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Members Section */}
            <div className="border rounded-md p-3 md:p-4">
              <button
                onClick={() => setActiveSection(activeSection === 'members' ? null : 'members')}
                className="w-full flex items-center justify-between text-sm font-medium mb-3"
              >
                <span>Team Members {members.length > 0 && `(${members.length})`}</span>
                {activeSection === 'members' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              
              {activeSection === 'members' && (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {member.user.name || member.user.email}
                          </div>
                          {member.user.name && (
                            <div className="text-xs text-muted-foreground">
                              {member.user.email}
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                          {getRoleIcon(member.role)}
                          <span>{member.role}</span>
                        </div>
                      </div>
                      
                      {canManageMembers && member.user.id !== session?.user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user.id)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {members.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      No members yet
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Invite Section */}
            <div className="border rounded-md p-3 md:p-4">
              <button
                onClick={() => setActiveSection(activeSection === 'invites' ? null : 'invites')}
                className="w-full flex items-center justify-between text-sm font-medium mb-3"
              >
                <span>Invite Members</span>
                {activeSection === 'invites' ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              
              {activeSection === 'invites' && (
                <div className="space-y-3">
                  {canManageMembers ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="invite-email" className="text-xs">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="text-sm rounded"
                          />
                        </div>
                        <div className="space-y-1">
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
                        size="sm"
                        className="w-full rounded"
                      >
                        {inviting ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-3.5 w-3.5" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                      
                      <div className="pt-3 border-t">
                        <h4 className="text-xs font-medium mb-2">Role Permissions</h4>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <User className="h-3.5 w-3.5 mt-0.5" />
                            <div>
                              <span className="font-medium">Member:</span> Can create and manage tasks
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Crown className="h-3.5 w-3.5 mt-0.5" />
                            <div>
                              <span className="font-medium">Admin:</span> Full organization control
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Only admins can invite new members
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DrawerWrapper>
  )
}
