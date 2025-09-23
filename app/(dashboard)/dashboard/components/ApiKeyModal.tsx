"use client"

import { Copy } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ApiKeyModalProps {
  apiKey: string
  onClose: () => void
}

export function ApiKeyModal({ apiKey, onClose }: ApiKeyModalProps) {
  if (!apiKey) return null

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[70]"
        onClick={onClose}
      />
      
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background border rounded-md shadow-xl z-[80] p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">API Key Created!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Save this key now. It won't be shown again.
          </p>
        </div>

        <div className="mb-4">
          <div className="p-3 bg-muted/50 rounded border">
            <p className="text-xs font-mono break-all select-all">
              {apiKey}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(apiKey)
              toast({
                title: "Copied!",
                description: "API key copied to clipboard",
                variant: "success",
              })
            }}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Key
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-muted"
          >
            Done
          </button>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <p className="text-xs text-yellow-700 dark:text-yellow-400">
            ⚠️ Store this key securely. For security reasons, we only show it once.
          </p>
        </div>
      </div>
    </>
  )
}
