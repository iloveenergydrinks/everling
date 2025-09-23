"use client"

import { X } from "lucide-react"
import { NotificationSetup } from "@/components/notification-setup"
import { toast } from "@/hooks/use-toast"

interface NotificationsDrawerProps {
  show: boolean
  onClose: () => void
  onComplete: () => void
}

export function NotificationsDrawer({
  show,
  onClose,
  onComplete,
}: NotificationsDrawerProps) {
  if (!show) return null

  return (
    <div className="fixed right-0 top-0 h-full w-[640px] bg-background border-l shadow-xl z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Daily Digest Settings</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          <NotificationSetup 
            onComplete={() => {
              onComplete()
              toast({
                title: "Success",
                description: "Notification preferences saved",
                variant: "success"
              })
            }}
          />
        </div>
      </div>
    </div>
  )
}
