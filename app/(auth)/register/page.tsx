"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [organizationEmail, setOrganizationEmail] = useState("")
  const [orgCheck, setOrgCheck] = useState<any>(null)
  const [checkingOrg, setCheckingOrg] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null)

  // Check organization availability
  const checkOrganization = async (orgName: string) => {
    if (!orgName.trim()) {
      setOrgCheck(null)
      return
    }

    setCheckingOrg(true)
    try {
      const response = await fetch("/api/auth/check-organization", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationName: orgName }),
      })

      const data = await response.json()
      setOrgCheck(data)
    } catch (error) {
      console.error("Failed to check organization:", error)
    } finally {
      setCheckingOrg(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Use selected suggestion if available
    const finalOrgName = selectedSuggestion?.name || formData.organizationName

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          organizationName: finalOrgName
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Registration failed")
      } else {
        setSuccess(true)
        setOrganizationEmail(data.organizationEmail)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData({
      ...formData,
      [id]: value,
    })
    
    // Check organization availability when organization name changes
    if (id === 'organizationName') {
      setSelectedSuggestion(null)
      // Debounce the check
      setTimeout(() => {
        if (value.trim() && value === formData.organizationName) {
          checkOrganization(value)
        }
      }, 500)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-green-600">Registration Successful!</CardTitle>
            <CardDescription>
              Your account has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 p-4">
              <p className="mb-2 text-sm font-medium">Your organization email:</p>
              <code className="block rounded bg-green-100 p-2 text-sm">
                {organizationEmail}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                Forward emails to this address to create tasks automatically
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Redirecting to login page...
            </p>
          </CardContent>
        </Card>
      </div>
    )
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
            Know before it matters
          </p>
        </div>

        {/* Register Form */}
        <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>
            Get started in seconds
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="Acme Inc"
                value={selectedSuggestion?.name || formData.organizationName}
                onChange={(e) => {
                  handleChange(e)
                  checkOrganization(e.target.value)
                }}
                required
              />
              
              {/* Organization Check Results */}
              {checkingOrg && (
                <div className="text-xs text-muted-foreground">
                  Checking availability...
                </div>
              )}
              
              {orgCheck && !orgCheck.available && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-3">
                    <strong>"{formData.organizationName}"</strong> is already taken
                  </p>
                  <p className="text-xs text-yellow-700 mb-3">
                    Choose one of these available alternatives:
                  </p>
                  <div className="space-y-2">
                    {orgCheck.suggestions?.map((suggestion: any, index: number) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setSelectedSuggestion(suggestion)
                          setFormData({
                            ...formData,
                            organizationName: suggestion.name
                          })
                        }}
                        className={`w-full p-2 text-left border rounded text-sm transition-colors ${
                          selectedSuggestion?.name === suggestion.name
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">{suggestion.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Agent email: {suggestion.agentEmail}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {orgCheck && orgCheck.available && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Available! Your agent email will be: {orgCheck.suggested?.agentEmail}
                </div>
              )}
              
              {!orgCheck && formData.organizationName && (
                <p className="text-xs text-muted-foreground">
                  This will be used to create your unique email address
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
        </Card>
      </div>
    </div>
  )
}
