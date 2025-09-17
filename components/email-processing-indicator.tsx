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
          setIsProcessing(data.isProcessing)
          setProcessingCount(data.processingCount)
          
          // Show success animation when processing completes
          if (!data.isProcessing && recentlyProcessed.length < data.recentlyProcessed.length) {
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 3000)
          }
          
          setRecentlyProcessed(data.recentlyProcessed)
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
          "bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl p-4 flex items-center gap-4",
          "animate-in slide-in-from-bottom-2 duration-300",
          "min-w-[320px]"
        )}>
          <div className="flex items-center justify-center">
            <div className="relative bg-blue-50 dark:bg-blue-950/30 rounded-full p-2">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="absolute -top-1 -right-1 bg-white dark:bg-gray-950 rounded-full p-0.5">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
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
          "border rounded-lg shadow-lg p-4 flex items-center gap-4",
          "animate-in slide-in-from-bottom-2 duration-300",
          "min-w-[320px]",
          "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50"
        )}>
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-100">
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