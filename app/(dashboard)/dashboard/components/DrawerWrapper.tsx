"use client"

import { X } from "lucide-react"
import { useEffect } from "react"

interface DrawerWrapperProps {
  show: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  wide?: boolean
}

export function DrawerWrapper({
  show,
  onClose,
  title,
  description,
  children,
  wide = false
}: DrawerWrapperProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [show])

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 md:bg-black/10 z-40 transition-opacity duration-300 ${
          show ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`
        fixed right-0 top-0 h-full bg-background border-l shadow-xl z-50 
        transition-transform duration-300 ease-out
        ${wide 
          ? 'w-full md:w-[800px] lg:w-[960px]' 
          : 'w-full md:w-[480px] lg:w-[640px]'
        }
        ${show ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b">
            <div className="flex-1 pr-4">
              <h2 className="text-base md:text-lg font-semibold">{title}</h2>
              {description && (
                <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
