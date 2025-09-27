'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { CheckCircle, X, Loader2 } from 'lucide-react'
import debounce from 'lodash/debounce'

export default function SetupOrganization() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [agentName, setAgentName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Redirect if user already has an organization
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/login')
      return
    }

    // Check if user already has an organization
    checkExistingOrganization()
  }, [session, status, router])

  const checkExistingOrganization = async () => {
    try {
      const response = await fetch('/api/user/organization')
      if (response.ok) {
        const data = await response.json()
        if (data.hasOrganization) {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Error checking organization:', error)
    }
  }

  // Debounced availability check
  const checkAvailability = useCallback(
    debounce(async (name: string) => {
      if (!name || name.length < 3) {
        setIsAvailable(null)
        return
      }

      setIsChecking(true)
      try {
        const response = await fetch(`/api/organization/check-availability?name=${encodeURIComponent(name)}`)
        const data = await response.json()
        
        setIsAvailable(data.available)
        if (!data.available && data.suggestions) {
          setSuggestions(data.suggestions)
        } else {
          setSuggestions([])
        }
      } catch (error) {
        console.error('Error checking availability:', error)
        setIsAvailable(null)
      } finally {
        setIsChecking(false)
      }
    }, 500),
    []
  )

  useEffect(() => {
    checkAvailability(agentName)
  }, [agentName, checkAvailability])

  const handleAgentNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '') // Only allow alphanumeric and hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    
    setAgentName(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agentName || agentName.length < 3) {
      toast({
        title: 'Invalid agent name',
        description: 'Agent name must be at least 3 characters',
        variant: 'error'
      })
      return
    }

    if (!isAvailable) {
      toast({
        title: 'Name not available',
        description: 'Please choose a different agent name',
        variant: 'error'
      })
      return
    }

    if (!organizationName.trim()) {
      toast({
        title: 'Organization name required',
        description: 'Please enter your organization name',
        variant: 'error'
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/organization/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          organizationName: organizationName.trim()
        })
      })

      if (response.ok) {
        toast({
          title: 'Organization created!',
          description: `Your agent email is ${agentName}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}`,
          variant: 'success'
        })
        
        // Force session refresh
        window.location.href = '/dashboard'
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create organization')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'error'
      })
      setIsCreating(false)
    }
  }

  const getStatusIcon = () => {
    if (!agentName || agentName.length < 3) return null
    if (isChecking) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    if (isAvailable === true) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (isAvailable === false) return <X className="h-4 w-4 text-red-600" />
    return null
  }

  const getStatusMessage = () => {
    if (!agentName) return 'Choose your unique agent name'
    if (agentName.length < 3) return 'Name must be at least 3 characters'
    if (isChecking) return 'Checking availability...'
    if (isAvailable === true) return `${agentName}@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'} is available!`
    if (isAvailable === false) return 'This name is already taken'
    return ''
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="border rounded">
          <div className="p-6 pb-0">
            <h2 className="text-lg font-medium">Welcome to Everling!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Let's set up your organization and choose your agent email address
            </p>
          </div>
          <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="organization">Organization Name</Label>
              <Input
                id="organization"
                type="text"
                placeholder="Acme Inc"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                disabled={isCreating}
                className="rounded"
              />
              <p className="text-xs text-muted-foreground">
                Your company or team name
              </p>
            </div>

            {/* Agent Email */}
            <div className="space-y-2">
              <Label htmlFor="agent">Agent Email Name</Label>
              <div className="relative">
                <Input
                  id="agent"
                  type="text"
                  placeholder="acme"
                  value={agentName}
                  onChange={handleAgentNameChange}
                  required
                  disabled={isCreating}
                  className="pr-10 rounded"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {getStatusIcon()}
                </div>
              </div>
              <p className={`text-xs ${
                isAvailable === false ? 'text-red-600' : 
                isAvailable === true ? 'text-green-600' : 
                'text-muted-foreground'
              }`}>
                {getStatusMessage()}
              </p>
              
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-2 p-3 border rounded bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Available alternatives:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setAgentName(suggestion)}
                        className="text-xs px-2 py-1 bg-background border rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {agentName && isAvailable && (
                <div className="mt-3 p-3 border rounded bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/50">
                  <p className="text-xs text-muted-foreground mb-1">Your agent email will be:</p>
                  <code className="text-sm font-mono text-green-700 dark:text-green-400">
                    {agentName}@{process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'everling.io'}
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Forward emails to this address to create tasks automatically.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full rounded"
              disabled={!isAvailable || !organizationName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating organization...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </form>
          </div>
        </div>
      </div>
    </div>
  )
}
