"use client"

import { CheckCircle, Copy } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { formatDate } from "@/lib/utils"
import { showConfirm, showPrompt } from "@/components/global-modal"

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
        cancelText: "Cancel",
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

  if (!show) return null

  const discordInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}&permissions=277025458240&scope=bot%20applications.commands`

  return (
    <div className="fixed right-0 top-0 h-full w-[640px] bg-background border-l shadow-xl z-50 overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <button onClick={onClose} className="text-sm px-3 py-1 rounded border hover:bg-muted">Close</button>
      </div>
      <div className="p-6 space-y-6">
        {/* Coming Soon Integrations */}
        <div className="border rounded p-4 relative opacity-60">
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 text-xs bg-muted rounded font-medium">Coming Soon</span>
          </div>
          <h3 className="text-sm font-medium mb-2">Google Calendar</h3>
          <p className="text-xs text-muted-foreground mb-3">Automatically add tasks with dates to your Google Calendar.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              className="px-3 py-1.5 text-xs border rounded opacity-50 cursor-not-allowed"
            >
              Connect Google
            </button>
            <select disabled className="text-xs border rounded px-2 py-1 opacity-50 cursor-not-allowed">
              <option>Default calendar</option>
            </select>
            <label className="text-xs flex items-center gap-1 opacity-50">
              <input type="checkbox" disabled className="accent-black cursor-not-allowed" />
              Auto-add tasks
            </label>
          </div>
        </div>
        
        <div className="border rounded p-4 relative opacity-60">
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 text-xs bg-muted rounded font-medium">Coming Soon</span>
          </div>
          <h3 className="text-sm font-medium mb-2">Outlook / Microsoft 365</h3>
          <p className="text-xs text-muted-foreground mb-3">Automatically add tasks with dates to your Outlook calendar.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled className="px-3 py-1.5 text-xs border rounded opacity-50 cursor-not-allowed">Connect Outlook</button>
            <select disabled className="text-xs border rounded px-2 py-1 opacity-50 cursor-not-allowed">
              <option>Default calendar</option>
            </select>
            <label className="text-xs flex items-center gap-1 opacity-50">
              <input type="checkbox" disabled className="accent-black cursor-not-allowed" />
              Auto-add tasks
            </label>
          </div>
        </div>
        
        {/* Discord Integration */}
        <div className="border rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <h3 className="text-sm font-medium">Discord</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Connect Discord to extract tasks from conversations. Tag @Everling to process threads like email forwarding.
          </p>
          {discordConnected ? (
            <div className="space-y-3">
              <div className="rounded-md border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-foreground" />
                    <div>
                      <p className="text-sm font-medium">Discord Connected</p>
                      <p className="text-xs text-muted-foreground">{discordUsername}</p>
                    </div>
                  </div>
                  <button
                    onClick={onDiscordDisconnect}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              
              <div className="grid gap-3 text-xs">
                <div className="rounded-md border p-3 bg-muted/20">
                  <p className="font-medium mb-2">How to use</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">@Everling</span>
                    <span className="text-muted-foreground">+ your instruction</span>
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    Examples: "Call plumber tomorrow 9am" • "Buy flowers for mom" • "Review document by Friday"
                  </div>
                </div>
                
                <div className="rounded-md border p-3">
                  <p className="font-medium mb-2">Add to another server</p>
                  <div className="relative">
                    <input
                      readOnly
                      className="w-full text-xs font-mono border rounded px-2 py-1 pr-8 bg-background"
                      value={discordInviteUrl}
                      onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => copyToClipboard(discordInviteUrl, 'discord-invite-connected')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={copied && copiedText === 'discord-invite-connected' ? 'Copied!' : 'Copy'}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={onDiscordConnect}
                className="px-3 py-1.5 text-xs bg-[#5865F2] text-white rounded hover:bg-[#4752C4] transition-colors"
              >
                Connect Discord
              </button>
              
              <div className="grid gap-3 text-xs">
                <div className="rounded-md border p-3 bg-muted/20">
                  <p className="font-medium mb-2">1. Add bot to your server</p>
                  <div className="relative">
                    <input
                      readOnly
                      className="w-full text-xs font-mono border rounded px-2 py-1 pr-8 bg-background"
                      value={discordInviteUrl}
                      onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => copyToClipboard(discordInviteUrl, 'discord-invite-disconnected')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={copied && copiedText === 'discord-invite-disconnected' ? 'Copied!' : 'Copy'}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                
                <div className="rounded-md border p-3">
                  <p className="font-medium mb-2">2. Start using</p>
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">@Everling</span>
                      <span className="text-muted-foreground">+ your instruction</span>
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      Examples: "Call plumber tomorrow 9am" • "Buy flowers for mom" • "Review document by Friday"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* API Access */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">API Access</h3>
            <button
              onClick={() => setShowApiSection(!showApiSection)}
              className="text-xs px-2 py-1 rounded border hover:bg-muted"
            >
              {showApiSection ? 'Hide' : 'Manage'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Programmatically manage tasks via REST API
          </p>
          
          {showApiSection && (
            <div className="space-y-4">
              {/* API Endpoint */}
              <div className="border rounded p-3">
                <h4 className="text-xs font-medium mb-2">API Endpoint</h4>
                <div className="relative">
                  <input
                    type="text"
                    value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api`}
                    readOnly
                    className="w-full text-xs font-mono border rounded px-2 py-1 pr-8 bg-muted/30"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api`, "api-endpoint")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={copied && copiedText === "api-endpoint" ? "Copied!" : "Copy"}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* API Keys */}
              <div className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium">API Keys</h4>
                  <button
                    onClick={async () => {
                      const name = await showPrompt(
                        "Create API Key",
                        "Enter a name for this API key:",
                        {
                          confirmText: "Create",
                          cancelText: "Cancel"
                        }
                      )
                      if (name) createApiKey(name)
                    }}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted"
                  >
                    + New Key
                  </button>
                </div>
                
                {loadingApi ? (
                  <p className="text-xs text-muted-foreground">Loading API keys...</p>
                ) : apiKeys.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No API keys yet</p>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="text-xs font-medium">{key.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Created {formatDate(key.createdAt)} · 
                            {key.lastUsed ? ` Last used ${formatDate(key.lastUsed)}` : ' Never used'}
                          </p>
                          {key.keyHint && (
                            <p className="text-xs font-mono text-muted-foreground mt-1">
                              sk_{key.keyHint.substring(0, 6)}...****
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteApiKey(key.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Start */}
              <div className="border rounded p-3">
                <h4 className="text-xs font-medium mb-2">Quick Start</h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Authentication</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yourdomain.com'}/api/tasks`}
                    </pre>
                  </div>
                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Create Task</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono">
{`POST /api/tasks
{ "title": "Task", "priority": "high" }`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
