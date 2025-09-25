"use client"

import { NotificationSetup } from "@/components/notification-setup"
import { toast } from "@/hooks/use-toast"
import { DrawerWrapper } from "./DrawerWrapper"

interface NotificationsDrawerProps {
  show: boolean
  onClose: () => void
  onComplete: () => void
  timezone?: string
  onTimezoneChange?: (tz: string) => void
}

export function NotificationsDrawer({
  show,
  onClose,
  onComplete,
  timezone,
  onTimezoneChange,
}: NotificationsDrawerProps) {
  return (
    <DrawerWrapper
      show={show}
      onClose={onClose}
      title="Daily Digest Settings"
      description="Configure how and when you receive task reminders"
    >
      <div className="p-4 md:p-6">
        <NotificationSetup 
          onComplete={() => {
            onComplete()
            toast({
              title: "Success",
              description: "Notification preferences saved",
              variant: "success"
            })
          }}
          timezone={timezone}
          onTimezoneChange={onTimezoneChange}
        />
      </div>
    </DrawerWrapper>
  )
}