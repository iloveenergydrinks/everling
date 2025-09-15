"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [magicLinkMode, setMagicLinkMode] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (magicLinkMode) {
        // Send magic link
        const result = await signIn("email", {
          email,
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
        {magicLinkSent ? (
          <CardContent className="text-center py-8">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
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
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
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
                    <button
                      type="button"
                      onClick={() => setMagicLinkMode(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
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
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
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
