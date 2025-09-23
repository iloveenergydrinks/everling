"use client"

import { useState, useEffect } from "react"
import { Loader2, Mail, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmailProcessingIndicator() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingCount, setProcessingCount] = useState(0)
  const [recentlyProcessed, setRecentlyProcessed] = useState<any[]>([])
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    // Check processing status every 2 seconds
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/processing-status')
        if (response.ok) {
          const data = await response.json()
          // Use email-specific status if available, otherwise fall back to combined status
          const emailStatus = data.emailProcessing || {
            isProcessing: data.isProcessing,
            count: data.processingCount,
            recentlyProcessed: data.recentlyProcessed?.filter((r: any) => r.fromEmail !== 'discord') || []
          }
          
          setIsProcessing(emailStatus.isProcessing)
          setProcessingCount(emailStatus.count)
          
          // Show success animation when processing completes
          if (!emailStatus.isProcessing && recentlyProcessed.length < emailStatus.recentlyProcessed.length) {
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 3000)
          }
          
          setRecentlyProcessed(emailStatus.recentlyProcessed)
        }
      } catch (error) {
        console.error('Failed to check processing status:', error)
      }
    }

    // Initial check
    checkStatus()

    // Set up polling
    const interval = setInterval(checkStatus, 2000)

    return () => clearInterval(interval)
  }, [recentlyProcessed.length])

  if (!isProcessing && !showSuccess && recentlyProcessed.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {isProcessing && (
        <div className={cn(
          "bg-background border rounded shadow-lg p-3 flex items-center gap-3",
          "animate-in slide-in-from-bottom-2 duration-300",
          "min-w-[280px]"
        )}>
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="bg-muted rounded-full p-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 bg-background rounded-full p-0.5 border">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Processing emails...</p>
            <p className="text-xs text-muted-foreground">
              {processingCount} email{processingCount !== 1 ? 's' : ''} in queue
            </p>
          </div>
        </div>
      )}

      {showSuccess && !isProcessing && (
        <div className={cn(
          "border rounded shadow-lg p-3 flex items-center gap-3",
          "animate-in slide-in-from-bottom-2 duration-300",
          "min-w-[280px]",
          "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
        )}>
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Tasks created successfully!
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {recentlyProcessed.length} email{recentlyProcessed.length !== 1 ? 's' : ''} processed
            </p>
          </div>
        </div>
      )}
    </div>
  )
}