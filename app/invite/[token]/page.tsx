'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Using border divs instead of Card components for consistency
import { toast } from '@/hooks/use-toast'
import { Loader2, Building, Mail, Users, CheckCircle } from 'lucide-react'

interface InviteDetails {
  id: string
  email: string
  role: string
  organization: {
    id: string
    name: string
    emailPrefix: string
  }
  invitedBy: {
    name: string | null
    email: string
  }
}

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // For new user registration
  const [isNewUser, setIsNewUser] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isAccepting, setIsAccepting] = useState(false)

  // Verify invitation token
  useEffect(() => {
    const verifyInvite = async () => {
      try {
        const response = await fetch(`/api/invite/verify?token=${params.token}`)
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Invalid invitation')
        }
        
        const data = await response.json()
        setInviteDetails(data)
        
        // Check if user needs to register
        if (!data.userExists && !session) {
          setIsNewUser(true)
        }
      } catch (error: any) {
        setError(error.message || 'Failed to verify invitation')
      } finally {
        setLoading(false)
      }
    }

    verifyInvite()
  }, [params.token, session])

  // Auto-accept for logged-in users
  useEffect(() => {
    if (session && inviteDetails && !isNewUser) {
      // If logged in user's email matches invite email, auto-accept
      if (session.user?.email === inviteDetails.email) {
        handleAcceptInvite()
      } else {
        setError('This invitation is for a different email address. Please sign in with the correct account.')
      }
    }
  }, [session, inviteDetails, isNewUser])

  const handleAcceptInvite = async () => {
    setIsAccepting(true)
    
    try {
      const response = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to accept invitation')
      }

      toast({
        title: 'Success!',
        description: `You've joined ${inviteDetails?.organization.name}`,
        variant: 'success'
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept invitation',
        variant: 'error'
      })
      setIsAccepting(false)
    }
  }

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !password || password.length < 8) {
      toast({
        title: 'Invalid input',
        description: 'Please provide a name and password (min 8 characters)',
        variant: 'error'
      })
      return
    }

    setIsAccepting(true)

    try {
      // Register new user
      const registerResponse = await fetch('/api/invite/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: params.token,
          name: name.trim(),
          password
        })
      })

      if (!registerResponse.ok) {
        const data = await registerResponse.json()
        throw new Error(data.error || 'Failed to create account')
      }

      // Sign in the new user
      const signInResult = await signIn('credentials', {
        email: inviteDetails?.email,
        password,
        redirect: false
      })

      if (!signInResult?.ok) {
        throw new Error('Failed to sign in after registration')
      }

      toast({
        title: 'Account created!',
        description: `Welcome to ${inviteDetails?.organization.name}`,
        variant: 'success'
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create account',
        variant: 'error'
      })
      setIsAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md border rounded">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-red-600 mb-4">Invalid Invitation</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/login')} className="w-full rounded">
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!inviteDetails) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg border rounded">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-medium">You're invited to join</h2>
            <h1 className="text-2xl font-semibold mt-2">{inviteDetails.organization.name}</h1>
          </div>
          <div className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-3 p-4 bg-muted/30 border rounded">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Agent email:</span>
              <code className="font-mono">{inviteDetails.organization.emailPrefix}@everling.io</code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Invited by:</span>
              <span>{inviteDetails.invitedBy.name || inviteDetails.invitedBy.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Your role:</span>
              <span className="capitalize">{inviteDetails.role}</span>
            </div>
          </div>

          {/* Action based on user status */}
          {isNewUser ? (
            <form onSubmit={handleRegisterAndAccept} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteDetails.email}
                  disabled
                  className="rounded bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isAccepting}
                  className="rounded"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Choose Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isAccepting}
                  className="rounded"
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded"
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account & Join'
                )}
              </Button>
            </form>
          ) : session ? (
            <Button
              onClick={handleAcceptInvite}
              className="w-full rounded"
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Sign in to accept this invitation
              </p>
              <Button
                onClick={() => signIn(undefined, { callbackUrl: `/invite/${params.token}` })}
                className="w-full rounded"
              >
                Sign In
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
