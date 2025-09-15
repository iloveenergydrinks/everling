"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function RegisterSuccessContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")
  const organizationEmail = searchParams.get("org")

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-md space-y-8 px-4">
        {/* Logo/Brand */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-light tracking-tight text-black">
              Everling.io
            </h1>
          </Link>
        </div>

        {/* Success Message */}
        <div className="space-y-6 text-center">
          {/* Checkmark Icon */}
          <div className="mx-auto h-16 w-16 rounded-full border-2 border-black flex items-center justify-center">
            <svg
              className="h-8 w-8 text-black"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-medium text-black">
              Check your email
            </h2>
            <p className="text-sm text-gray-600">
              We've sent a verification link to
            </p>
            <p className="text-sm font-medium text-black">
              {email || "your email address"}
            </p>
          </div>

          {organizationEmail && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-2">
                Your AI assistant email will be:
              </p>
              <p className="text-sm font-mono text-black">
                {organizationEmail}
              </p>
            </div>
          )}

          <div className="space-y-3 pt-6">
            <p className="text-xs text-gray-500">
              Click the link in your email to verify your account and sign in.
            </p>
            
            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                className="inline-block text-sm text-black underline hover:no-underline"
              >
                Already verified? Sign in
              </Link>
              
              <button
                onClick={() => {
                  // TODO: Implement resend verification email
                  alert("Resend functionality coming soon")
                }}
                className="text-sm text-gray-600 hover:text-black transition-colors"
              >
                Didn't receive the email? Resend
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-xs text-gray-400">
            Emails may take a few minutes to arrive
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    }>
      <RegisterSuccessContent />
    </Suspense>
  )
}
