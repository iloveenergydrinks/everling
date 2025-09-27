"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function UniversalProcessingIndicator() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingCount, setProcessingCount] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successCount, setSuccessCount] = useState(0)

  useEffect(() => {
    let previousProcessingCount = 0
    
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/processing-status')
        if (response.ok) {
          const data = await response.json()
          
          // Combine all processing sources
          const totalProcessing = data.isProcessing
          const totalCount = data.processingCount || 0
          
          setIsProcessing(totalProcessing)
          setProcessingCount(totalCount)
          
          // Show success animation when processing completes
          if (!totalProcessing && previousProcessingCount > 0) {
            setShowSuccess(true)
            setSuccessCount(previousProcessingCount)
            setTimeout(() => {
              setShowSuccess(false)
              setSuccessCount(0)
            }, 3000)
          }
          
          previousProcessingCount = totalCount
        }
      } catch (error) {
        console.error('Failed to check processing status:', error)
      }
    }

    // Initial check
    checkStatus()

    // Set up polling every 1.5 seconds
    const interval = setInterval(checkStatus, 1500)

    return () => clearInterval(interval)
  }, [])

  if (!isProcessing && !showSuccess) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isProcessing && (
        <div className={cn(
          "bg-background border rounded-md shadow-lg p-3 flex items-center gap-3",
          "animate-in slide-in-from-bottom-2 duration-300",
          "min-w-[280px]"
        )}>
          <div className="relative">
            <div className="bg-muted rounded-full p-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Processing {processingCount === 1 ? 'a new message' : `${processingCount} new messages`}...
            </p>
            <p className="text-xs text-muted-foreground">
              Please wait
            </p>
          </div>
        </div>
      )}

      {showSuccess && !isProcessing && (
        <div className={cn(
          "bg-background border rounded-md shadow-lg p-3 flex items-center gap-3",
          "animate-in slide-in-from-bottom-2 duration-300",
          "min-w-[280px]",
          "border-green-200 dark:border-green-800"
        )}>
          <div className="relative">
            <div className="bg-green-100 dark:bg-green-900/20 rounded-full p-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Task{successCount !== 1 ? 's' : ''} created successfully!
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {successCount} message{successCount !== 1 ? 's' : ''} processed
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
