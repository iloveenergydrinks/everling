"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to send reset link")
      } else {
        setSent(true)
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
            Reset your password
          </p>
        </div>

        {/* Reset Form */}
        <Card className="w-full rounded">
          {sent ? (
            <CardContent className="text-center py-8">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">Check your email</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Click the link in your email to set a new password
                </p>
              </div>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setSent(false)
                    setEmail("")
                  }}
                  variant="outline" 
                  className="w-full"
                >
                  Send another link
                </Button>
                <Link href="/login" className="block">
                  <Button variant="ghost" className="w-full">
                    Back to login
                  </Button>
                </Link>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Forgot your password?</CardTitle>
                <CardDescription>
                  No worries! Enter your email and we'll send you a secure link to sign in
                </CardDescription>
              </CardHeader>
              
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {error && (
                    <div className="rounded bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Button type="submit" className="w-full" disabled={loading || !email}>
                      {loading ? "Sending reset link..." : "Send reset link"}
                    </Button>
                    
                    <Link href="/login" className="block">
                      <Button variant="ghost" className="w-full">
                        Back to login
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
