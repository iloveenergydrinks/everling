"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ModalState {
  isOpen: boolean
  title: string
  message: string
  type: "alert" | "confirm" | "prompt"
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  promptValue?: string
  onPromptConfirm?: (value: string) => void
}

// Global state management for modals
let globalSetModalState: React.Dispatch<React.SetStateAction<ModalState>> | null = null

export function GlobalModal() {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: "",
    message: "",
    type: "alert",
  })

  const [inputValue, setInputValue] = useState("")

  // Register the setter globally
  globalSetModalState = setModalState

  const handleClose = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }))
    setInputValue("")
  }, [])

  const handleConfirm = useCallback(() => {
    if (modalState.type === "prompt" && modalState.onPromptConfirm) {
      modalState.onPromptConfirm(inputValue)
    } else if (modalState.onConfirm) {
      modalState.onConfirm()
    }
    handleClose()
  }, [modalState, inputValue, handleClose])

  const handleCancel = useCallback(() => {
    if (modalState.onCancel) {
      modalState.onCancel()
    }
    handleClose()
  }, [modalState, handleClose])

  return (
    <Dialog open={modalState.isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{modalState.title}</DialogTitle>
          {modalState.message && (
            <DialogDescription>{modalState.message}</DialogDescription>
          )}
        </DialogHeader>

        {modalState.type === "prompt" && (
          <div className="py-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter value..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfirm()
                }
              }}
            />
          </div>
        )}

        <DialogFooter>
          {modalState.type !== "alert" && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="rounded-sm"
            >
              {modalState.cancelText || "Cancel"}
            </Button>
          )}
          <Button
            variant={modalState.variant || "default"}
            onClick={handleConfirm}
            className="rounded-sm"
          >
            {modalState.confirmText || "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Global functions to show modals
export const showAlert = (title: string, message?: string) => {
  if (globalSetModalState) {
    globalSetModalState({
      isOpen: true,
      title,
      message: message || "",
      type: "alert",
      confirmText: "OK",
    })
  }
}

export const showConfirm = (
  title: string,
  message?: string,
  options?: {
    confirmText?: string
    cancelText?: string
    variant?: "default" | "destructive"
    onConfirm?: () => void
    onCancel?: () => void
  }
) => {
  return new Promise<boolean>((resolve) => {
    if (globalSetModalState) {
      globalSetModalState({
        isOpen: true,
        title,
        message: message || "",
        type: "confirm",
        confirmText: options?.confirmText || "Confirm",
        cancelText: options?.cancelText || "Cancel",
        variant: options?.variant,
        onConfirm: () => {
          options?.onConfirm?.()
          resolve(true)
        },
        onCancel: () => {
          options?.onCancel?.()
          resolve(false)
        },
      })
    } else {
      resolve(false)
    }
  })
}

export const showPrompt = (
  title: string,
  message?: string,
  options?: {
    confirmText?: string
    cancelText?: string
    defaultValue?: string
  }
) => {
  return new Promise<string | null>((resolve) => {
    if (globalSetModalState) {
      globalSetModalState({
        isOpen: true,
        title,
        message: message || "",
        type: "prompt",
        confirmText: options?.confirmText || "OK",
        cancelText: options?.cancelText || "Cancel",
        promptValue: options?.defaultValue || "",
        onPromptConfirm: (value) => {
          resolve(value)
        },
        onCancel: () => {
          resolve(null)
        },
      })
    } else {
      resolve(null)
    }
  })
}

