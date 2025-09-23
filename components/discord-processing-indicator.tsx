"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function DiscordIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

export function DiscordProcessingIndicator() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [count, setCount] = useState(0)
  const [justFinished, setJustFinished] = useState(false)

  useEffect(() => {
    let prev = 0
    const tick = async () => {
      try {
        const res = await fetch('/api/processing-status')
        if (res.ok) {
          const data = await res.json()
          const discordOnly = data // merged already; we just surface a unified indicator
          const nowProcessing = Boolean(discordOnly.isProcessing)
          setIsProcessing(nowProcessing)
          setCount(discordOnly.processingCount || 0)
          if (!nowProcessing && prev > 0) {
            setJustFinished(true)
            setTimeout(() => setJustFinished(false), 1500)
          }
          prev = discordOnly.processingCount || 0
        }
      } catch {}
    }
    tick()
    const h = setInterval(tick, 1500)
    return () => clearInterval(h)
  }, [])

  if (!isProcessing && !justFinished) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={cn(
        "bg-background border rounded shadow-lg p-3 flex items-center gap-3",
        "animate-in slide-in-from-bottom-2 duration-300",
        "min-w-[280px]"
      )}>
        <div className="relative">
          <div className="bg-muted rounded-full p-1.5">
            <DiscordIcon />
          </div>
          {isProcessing && (
            <div className="absolute -top-0.5 -right-0.5 bg-background rounded-full p-0.5 border">
              <Loader2 className="h-2.5 w-2.5 animate-spin text-[#5865F2]" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {isProcessing ? 'Processing Discord…' : 'Discord processed'}
          </p>
          {isProcessing && (
            <p className="text-xs text-muted-foreground">{count} in queue</p>
          )}
        </div>
      </div>
    </div>
  )
}


