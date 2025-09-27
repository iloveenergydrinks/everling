'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function PricingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isAnnual, setIsAnnual] = useState(false)

  const handleGetStarted = () => {
    if (session) {
      router.push('/dashboard')
    } else {
      router.push('/register')
    }
  }

  const handleUpgrade = () => {
    // Will implement Stripe checkout here
    router.push('/dashboard/settings?upgrade=true')
  }

  const monthlyPrice = 5
  const annualPrice = 50 // 2 months free
  const displayPrice = isAnnual ? annualPrice : monthlyPrice
  const priceLabel = isAnnual ? '/year' : '/month'
  const savingsLabel = isAnnual ? 'Save $10' : ''

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free. Upgrade when you need more. Cancel anytime.
          </p>
          
          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm ${!isAnnual ? 'font-medium' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition ${
                  isAnnual ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'font-medium' : 'text-muted-foreground'}`}>
              Annual
              {isAnnual && (
                <span className="ml-1 text-xs text-green-600 font-medium">
                  (2 months free)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="rounded-lg border bg-card p-8">
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Perfect for trying out Everling
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">100 tasks per month</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">Email to task</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">AI task processing</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">Daily digest emails</span>
              </li>
              <li className="flex items-center gap-3">
                <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">SMS reminders</span>
              </li>
              <li className="flex items-center gap-3">
                <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Discord integration</span>
              </li>
              <li className="flex items-center gap-3">
                <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">API access</span>
              </li>
            </ul>

            <button
              onClick={handleGetStarted}
              className="w-full py-2 px-4 rounded-md border border-foreground/20 hover:bg-muted transition-colors text-sm font-medium"
            >
              Get Started
            </button>
          </div>

          {/* Pro Tier */}
          <div className="rounded-lg border-2 border-primary bg-card p-8 relative">
            {/* Popular Badge */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium">
                Most Popular
              </span>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">${displayPrice}</span>
                <span className="text-muted-foreground">{priceLabel}</span>
              </div>
              {savingsLabel && (
                <p className="text-sm text-green-600 font-medium mt-1">
                  {savingsLabel}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Everything you need to stay organized
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm font-medium">Unlimited tasks</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">Everything in Free</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">SMS reminders</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">Discord integration</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">API access</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">Priority support</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm">Export your data</span>
              </li>
            </ul>

            <button
              onClick={handleUpgrade}
              className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <h3 className="font-medium mb-2">Can I change plans anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! You can upgrade or downgrade at any time. Changes take effect on your next billing cycle.
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-medium mb-2">What happens if I exceed the free plan limit?</h3>
              <p className="text-sm text-muted-foreground">
                We'll notify you when you're approaching your limit. Once you hit 100 tasks, you'll need to upgrade to continue creating tasks.
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-medium mb-2">Is there a trial period for Pro?</h3>
              <p className="text-sm text-muted-foreground">
                Start with the free plan to try all core features. You can upgrade to Pro whenever you're ready - no trial needed!
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-medium mb-2">How do I cancel my subscription?</h3>
              <p className="text-sm text-muted-foreground">
                You can cancel anytime from your dashboard settings. You'll continue to have Pro access until the end of your billing period.
              </p>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-medium mb-2">Do you offer team plans?</h3>
              <p className="text-sm text-muted-foreground">
                Team plans are coming soon! For now, Pro accounts work great for personal productivity.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Ready to get organized?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands who've simplified their task management with Everling's AI-powered platform.
          </p>
          <button
            onClick={handleGetStarted}
            className="px-8 py-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Start Free Today
          </button>
        </div>
      </div>
    </div>
  )
}
