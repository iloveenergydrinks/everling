"use client"

import { CheckCircle, Copy, ChevronDown, ChevronRight, X, Plus, MessageSquare, Command, Users, ExternalLink } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { formatDate } from "@/lib/utils"
import { showConfirm, showPrompt } from "@/components/global-modal"
import { DrawerWrapper } from "./DrawerWrapper"

// Discord Logo SVG Component
const DiscordLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
  </svg>
)

// Slack Logo SVG Component
const SlackLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 127 127" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80s5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A"/>
    <path d="M47 27c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.5 39.7.6 47 .6c7.3 0 13.2 5.9 13.2 13.2V27H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.1.7 54.2.7 46.9c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0"/>
    <path d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V46.9zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.8C66.9 6.5 72.8.6 80.1.6c7.3 0 13.2 5.9 13.2 13.2v33.1z" fill="#2EB67D"/>
    <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E"/>
  </svg>
)

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
    if (show) {
      // Fetch Discord connection status when drawer opens
      fetchDiscordStatus()
      
      if (showApiSection) {
        fetchApiKeys()
      }
    }
  }, [show, showApiSection])
  
  const fetchDiscordStatus = async () => {
    try {
      const response = await fetch('/api/user/discord-status')
      if (response.ok) {
        const data = await response.json()
        if (data.connected !== discordConnected || data.username !== discordUsername) {
          // Update parent component if status changed
          window.dispatchEvent(new CustomEvent('discord-status-update', {
            detail: {
              connected: data.connected,
              username: data.username
            }
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching Discord status:', error)
    }
  }
  
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
          <div className="border rounded-lg">
            <div className="flex items-start justify-between p-3 md:p-4 border-b">
              <div className="flex items-center gap-3">
                <DiscordLogo className="h-5 w-5 text-[#5865F2]" />
                <div>
                  <h3 className="text-sm font-medium">Discord</h3>
                  {discordConnected ? (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Connected as @{discordUsername}
                    </p>
                  ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create tasks and receive private DM digests
                  </p>
                  )}
                </div>
              </div>
              {discordConnected && (
                <button
                  onClick={handleDiscordAction}
                  className="text-xs px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
            
            <div className="p-3 md:p-4 space-y-4">
              {discordConnected ? (
                <>
                  {/* How to use section */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">HOW TO USE</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm">Mention the Bot</p>
                          <p className="text-xs text-muted-foreground">@Everling "meeting tomorrow at 3pm" - responds privately via DM</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <Command className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm">Private Daily Digests</p>
                          <p className="text-xs text-muted-foreground">Receive your tasks via DM every morning (enable DMs in Discord)</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Invite bot section */}
                  <div className="border rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Add bot to your server</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Invite Everling to your Discord servers - all responses sent privately via DM
                        </p>
                        <a
                          href={`https://discord.com/api/oauth2/authorize?client_id=1419770476363907203&permissions=274877908992&scope=bot%20applications.commands`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-[#5865F2] hover:text-[#4752C4] transition-colors"
                        >
                          Invite Bot to Server
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Quick tips */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">QUICK TIPS</p>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/60">•</span>
                        <span>Enable "Allow DMs from server members" in Discord</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/60">•</span>
                        <span>Use /digest to get your tasks instantly</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/60">•</span>
                        <span>Daily digests sent automatically at your configured time</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-muted-foreground/60">•</span>
                        <span>All messages are private - only you see them</span>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">Natural Language Tasks</p>
                        <p className="text-xs text-muted-foreground">Mention the bot - all responses sent privately via DM</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Command className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">Private Daily Digests</p>
                        <p className="text-xs text-muted-foreground">Get your tasks delivered via DM every morning</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <DiscordLogo className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">Complete Privacy</p>
                        <p className="text-xs text-muted-foreground">Only you see your tasks - everything via DM</p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleDiscordAction}
                    className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
                  >
                    <DiscordLogo className="h-4 w-4" />
                    Connect Discord
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* API Access Section */}
          <div className="border rounded-lg p-3 md:p-4">
            <button
              onClick={() => setShowApiSection(!showApiSection)}
              className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
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

          {/* Slack (Coming Soon) */}
          <div className="border rounded-lg">
            <div className="flex items-start justify-between p-3 md:p-4 border-b">
              <div className="flex items-center gap-3">
                <SlackLogo className="h-5 w-5" />
                <div>
                  <h3 className="text-sm font-medium">Slack</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create tasks directly from Slack conversations
                  </p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground">
                Coming Soon
              </span>
            </div>
            
            <div className="p-3 md:p-4 space-y-4">
              <div className="space-y-3 opacity-60">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">Slash Commands</p>
                    <p className="text-xs text-muted-foreground">/everling "meeting tomorrow" - Create tasks instantly</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Command className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">Message Actions</p>
                    <p className="text-xs text-muted-foreground">Right-click any message → Create Task</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm">Team Collaboration</p>
                    <p className="text-xs text-muted-foreground">Share tasks with channels, assign to teammates</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-3 border-t">
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 bg-muted text-muted-foreground rounded-md cursor-not-allowed opacity-50"
                >
                  <SlackLogo className="h-4 w-4" />
                  Coming Soon
                </button>
              </div>
            </div>
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
        </div>
      </div>
    </DrawerWrapper>
  )
}