'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { ChevronDown, Building, Plus, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface Organization {
  id: string
  name: string
  slug: string
  role: string
}

export function OrganizationSwitcher() {
  const { data: session } = useSession()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch user's organizations
  useEffect(() => {
    fetchOrganizations()
  }, [session])

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/user/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations)
        
        // Set current org from session or first org
        const current = data.organizations.find(
          (org: Organization) => org.id === session?.user?.organizationId
        ) || data.organizations[0]
        
        setCurrentOrg(current)
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const switchOrganization = async (org: Organization) => {
    if (org.id === currentOrg?.id) {
      setIsOpen(false)
      return
    }

    try {
      // Update server-side session
      const response = await fetch('/api/user/switch-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: org.id })
      })

      if (response.ok) {
        // Force a full page reload to refresh the session completely
        // This ensures the JWT token is refreshed with the new organization
        toast({
          title: 'Organization switched',
          description: `Switching to ${org.name}...`,
          variant: 'success'
        })
        
        setCurrentOrg(org)
        setIsOpen(false)
        
        // Use a small delay to let the toast show, then do a hard refresh
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 500)
      } else {
        throw new Error('Failed to switch organization')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to switch organization',
        variant: 'error'
      })
    }
  }

  const createNewOrganization = () => {
    window.location.href = '/setup?new=true'
  }

  if (loading || !currentOrg) {
    return (
      <div className="h-9 w-32 bg-muted/50 rounded animate-pulse" />
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded hover:bg-muted/50 transition-colors"
      >
        <Building className="h-4 w-4" />
        <span className="hidden sm:inline">{currentOrg.name}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-background border rounded shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
              Organizations
            </div>
            
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrganization(org)}
                className="w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {org.slug}@everling.io · {org.role}
                    </div>
                  </div>
                </div>
                {org.id === currentOrg.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
            
            <div className="border-t mt-2 pt-2">
              <button
                onClick={createNewOrganization}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted/50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Organization</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
