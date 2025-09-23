"use client"

import { CheckCircle, Copy, ChevronDown, ChevronRight, X, Plus } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { formatDate } from "@/lib/utils"
import { showConfirm, showPrompt } from "@/components/global-modal"
import { DrawerWrapper } from "./DrawerWrapper"

interface ApiKey {
  id: string
  name: string
  keyHint?: string
  lastUsed: string | null
  createdAt: string
}

interface IntegrationsDrawerProps {
  show: boolean
  onClose: () => void
  discordConnected: boolean
  discordUsername: string
  onDiscordConnect: () => void
  onDiscordDisconnect: () => void
  onNewApiKey?: (key: string) => void
}

export function IntegrationsDrawer({
  show,
  onClose,
  discordConnected,
  discordUsername,
  onDiscordConnect,
  onDiscordDisconnect,
  onNewApiKey,
}: IntegrationsDrawerProps) {
  const [copied, setCopied] = useState(false)
  const [copiedText, setCopiedText] = useState("")
  
  // API state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loadingApi, setLoadingApi] = useState(false)
  const [showApiSection, setShowApiSection] = useState(false)
  
  useEffect(() => {
    if (show && showApiSection) {
      fetchApiKeys()
    }
  }, [show, showApiSection])
  
  const fetchApiKeys = async () => {
    setLoadingApi(true)
    try {
      const response = await fetch("/api/keys")
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data)
      }
    } catch (error) {
      console.error("Error fetching API keys:", error)
    } finally {
      setLoadingApi(false)
    }
  }
  
  const createApiKey = async (name: string) => {
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      
      if (response.ok) {
        const data = await response.json()
        if (onNewApiKey) onNewApiKey(data.key)
        fetchApiKeys()
      }
    } catch (error) {
      console.error("Error creating API key:", error)
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "error",
      })
    }
  }
  
  const deleteApiKey = async (id: string) => {
    const confirmed = await showConfirm(
      "Delete API Key",
      "This action cannot be undone. Are you sure you want to delete this API key?",
      {
        confirmText: "Delete",
        variant: "destructive"
      }
    )
    
    if (!confirmed) return
    
    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: "DELETE",
      })
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "API key deleted successfully",
          variant: "success",
        })
        fetchApiKeys()
      }
    } catch (error) {
      console.error("Error deleting API key:", error)
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "error",
      })
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setCopiedText(label)
    setTimeout(() => {
      setCopied(false)
      setCopiedText("")
    }, 2000)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
      variant: "success",
    })
  }

  const handleDiscordAction = async () => {
    if (discordConnected) {
      const confirmed = await showConfirm(
        "Disconnect Discord",
        "Are you sure you want to disconnect your Discord account? You'll need to reconnect to use Discord features.",
        {
          confirmText: "Disconnect",
          variant: "destructive"
        }
      )
      
      if (confirmed) {
        onDiscordDisconnect()
      }
    } else {
      onDiscordConnect()
    }
  }

  return (
    <DrawerWrapper
      show={show}
      onClose={onClose}
      title="Integrations"
      description="Connect external services and manage API access"
    >
      <div className="p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          {/* Discord Integration */}
          <div className="border rounded-lg p-3 md:p-4">
            <h3 className="text-sm font-medium mb-3">Discord</h3>
            {discordConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Connected
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      @{discordUsername}
                    </p>
                  </div>
                  <button
                    onClick={handleDiscordAction}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• Message the bot to create tasks</p>
                  <p>• Use /task command in servers</p>
                  <p>• Get task reminders in Discord</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Connect Discord to create and manage tasks directly from Discord
                </p>
                <button
                  onClick={handleDiscordAction}
                  className="w-full md:w-auto text-sm px-4 py-2.5 bg-[#5865F2] text-white rounded hover:bg-[#4752C4]"
                >
                  Connect Discord
                </button>
              </div>
            )}
          </div>

          {/* API Access Section */}
          <div className="border rounded-lg p-3 md:p-4">
            <button
              onClick={() => setShowApiSection(!showApiSection)}
              className="w-full flex items-center justify-between mb-3 hover:opacity-80 transition-opacity"
            >
              <h3 className="text-sm font-medium flex items-center gap-2">
                API Access
                {showApiSection ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </h3>
              <span className="text-xs text-muted-foreground">
                {apiKeys.length} {apiKeys.length === 1 ? 'key' : 'keys'}
              </span>
            </button>
            
            {showApiSection && (
              <div className="space-y-4">
                {/* API Endpoint */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">API Endpoint</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      https://everling.io/api/tasks
                    </code>
                    <button
                      onClick={() => copyToClipboard("https://everling.io/api/tasks", "API endpoint")}
                      className="p-1.5 hover:bg-muted rounded-md flex-shrink-0"
                    >
                      {copied && copiedText === "API endpoint" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* API Keys Management */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">API Keys</p>
                    <button
                      onClick={async () => {
                        const name = await showPrompt(
                          "Create API Key",
                          "Enter a name for this API key",
                          {
                            confirmText: "Create",
                            defaultValue: ""
                          }
                        )
                        if (name) {
                          createApiKey(name)
                        }
                      }}
                      className="text-xs px-3 py-1.5 bg-foreground text-background rounded hover:bg-foreground/90 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Create Key
                    </button>
                  </div>

                  {loadingApi ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Loading keys...
                    </p>
                  ) : apiKeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No API keys yet. Create one to get started.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {apiKeys.map((key) => (
                        <div key={key.id} className="flex items-start justify-between p-2 border rounded hover:bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{key.name}</p>
                            <p className="text-xs text-muted-foreground">
                              •••• {key.keyHint}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Created {formatDate(key.createdAt)}
                            </p>
                            {key.lastUsed && (
                              <p className="text-xs text-muted-foreground">
                                Last used {formatDate(key.lastUsed)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteApiKey(key.id)}
                            className="p-1 hover:bg-background rounded ml-2 flex-shrink-0"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Start Documentation */}
                <div className="border-t pt-4">
                  <p className="text-xs font-medium mb-2">Quick Start</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Create a task:</p>
                      <div className="bg-muted p-2 rounded overflow-x-auto">
                        <code className="text-xs whitespace-pre">{`curl -X POST https://everling.io/api/tasks \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Task title","description":"Task description"}'`}</code>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Get your tasks:</p>
                      <div className="bg-muted p-2 rounded overflow-x-auto">
                        <code className="text-xs whitespace-pre">{`curl https://everling.io/api/tasks \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
                      </div>
                    </div>

                    <button
                      onClick={() => copyToClipboard(
                        `curl -X POST https://everling.io/api/tasks \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Task title","description":"Task description"}'`,
                        "cURL example"
                      )}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Copy example →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Google Calendar (Coming Soon) */}
          <div className="border rounded-lg p-3 md:p-4 opacity-60">
            <h3 className="text-sm font-medium mb-3">Google Calendar</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Sync tasks with Google Calendar (Coming soon)
            </p>
            <button
              disabled
              className="text-sm px-4 py-2 border rounded opacity-50 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>

          {/* Slack (Coming Soon) */}
          <div className="border rounded-lg p-3 md:p-4 opacity-60">
            <h3 className="text-sm font-medium mb-3">Slack</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Create and manage tasks from Slack (Coming soon)
            </p>
            <button
              disabled
              className="text-sm px-4 py-2 border rounded opacity-50 cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </DrawerWrapper>
  )
}