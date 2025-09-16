"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicLinkMode, setMagicLinkMode] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  useEffect(() => {
    // Handle verification success
    if (searchParams.get('verified') === 'true') {
      setSuccess('Email verified successfully! You can now sign in.')
    }
    
    // Handle errors
    const errorParam = searchParams.get('error')
    if (errorParam === 'InvalidToken') {
      setError('Invalid verification link. Please try again.')
    } else if (errorParam === 'TokenExpired') {
      setError('Verification link has expired. Please request a new one.')
    } else if (errorParam === 'VerificationFailed') {
      setError('Email verification failed. Please try again.')
    } else if (errorParam === 'OAuthAccountNotLinked') {
      setError('An account with this email already exists. Please sign in with your password or use the magic link.')
    } else if (errorParam === 'LinkExpired') {
      setError('This sign-in link has expired. Please request a new one.')
    } else if (errorParam === 'InvalidLink') {
      setError('Invalid sign-in link. Please request a new one.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (magicLinkMode) {
        // Send magic link with dashboard as callback
        const result = await signIn("email", {
          email,
          callbackUrl: `${window.location.origin}/dashboard`,
          redirect: false,
        })

        if (result?.error) {
          setError("Failed to send magic link. Please try again.")
        } else {
          setMagicLinkSent(true)
        }
      } else {
        // Regular password login
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError("Invalid email or password")
        } else {
          router.push("/dashboard")
          router.refresh()
        }
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-md px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-medium hover:text-muted-foreground transition-colors">
            ← Everling.io
          </Link>
          <p className="text-sm text-muted-foreground mt-2">
            Welcome back
          </p>
        </div>

        {/* Login Form */}
        <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to continue
          </CardDescription>
        </CardHeader>
        
        {/* Success message */}
        {success && (
          <div className="mx-6 mb-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-center">
            <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
          </div>
        )}
        
        {magicLinkSent ? (
          <CardContent className="text-center py-8">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Check your email</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Click the link in your email to sign in instantly
              </p>
            </div>
            <Button 
              onClick={() => {
                setMagicLinkSent(false)
                setMagicLinkMode(false)
                setEmail("")
              }}
              variant="outline" 
              className="w-full"
            >
              Back to login
            </Button>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-md">
                <button
                  type="button"
                  onClick={() => setMagicLinkMode(false)}
                  className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                    !magicLinkMode 
                      ? 'bg-background shadow-sm' 
                      : 'hover:bg-muted-foreground/10'
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMagicLinkMode(true)}
                  className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors ${
                    magicLinkMode 
                      ? 'bg-background shadow-sm' 
                      : 'hover:bg-muted-foreground/10'
                  }`}
                >
                  Magic Link
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              {!magicLinkMode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {magicLinkMode && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-800">
                    We'll send you a secure link to sign in without a password
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading 
                  ? (magicLinkMode ? "Sending link..." : "Signing in...") 
                  : (magicLinkMode ? "Send magic link" : "Sign in")
                }
              </Button>
              
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                disabled={loading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>
              
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen py-12">
        <div className="mx-auto max-w-md px-6">
          <div className="mb-8 text-center">
            <p className="text-2xl font-medium">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
