'use client'

import { Mail, Zap, Clock, Users, Shield, Brain, MessageSquare, Phone, Link } from 'lucide-react'
import { DrawerWrapper } from './DrawerWrapper'

// Discord Logo SVG Component (same as in IntegrationsDrawer)
const DiscordLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
  </svg>
)

interface HowItWorksDrawerProps {
  show: boolean
  onClose: () => void
}

export function HowItWorksDrawer({ show, onClose }: HowItWorksDrawerProps) {
  return (
    <DrawerWrapper
      show={show}
      onClose={onClose}
      title="How Everling Works"
      description="Your intelligent task management system"
    >
      <div className="p-4 md:p-6">
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="text-center py-4 border-b">
            <h3 className="text-lg font-medium mb-2">
              Task Management That Adapts to You
            </h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Everling uses AI to transform your emails, messages, and conversations into 
              actionable tasks. No learning curve, no complex setup. Just forward an email 
              and watch the magic happen.
            </p>
          </div>

          {/* How It Works Steps */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Three Simple Steps</h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Send or Forward</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Forward any email to your organization's unique email address. 
                    Works from Gmail, Outlook, or any email client.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">AI Processes</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Our AI instantly extracts key information: deadlines, assignees, 
                    priorities, and action items. No manual parsing needed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-medium flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Stay Updated</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get reminders via email, SMS, or Discord. Reply "done" to complete 
                    tasks instantly. Everything syncs in real-time.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Why Teams Love Everling</h4>
            
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3">
                <Brain className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Smart AI Understanding</p>
                  <p className="text-xs text-muted-foreground">
                    Understands context, dates, and priorities naturally
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Instant Processing</p>
                  <p className="text-xs text-muted-foreground">
                    Tasks created in seconds, not minutes
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Team Collaboration</p>
                  <p className="text-xs text-muted-foreground">
                    Auto-assign tasks and track responsibilities
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Privacy First</p>
                  <p className="text-xs text-muted-foreground">
                    Your data stays yours, always encrypted
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Email-Native</p>
                  <p className="text-xs text-muted-foreground">
                    Works where you already work - your inbox
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Smart Reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Never miss a deadline with intelligent alerts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Integration Examples */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Works Everywhere</h4>
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center">
                  <Mail className="h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Email</p>
                </div>
                <div className="flex flex-col items-center">
                  <DiscordLogo className="h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Discord</p>
                </div>
                <div className="flex flex-col items-center">
                  <Phone className="h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">SMS</p>
                </div>
                <div className="flex flex-col items-center">
                  <Link className="h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">API</p>
                </div>
              </div>
            </div>
          </div>

          {/* Use Cases */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Perfect For</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Busy Professionals:</strong> Capture action items from meetings instantly</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Remote Teams:</strong> Stay aligned across time zones</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Project Managers:</strong> Track deliverables without spreadsheets</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Customer Support:</strong> Turn requests into trackable tasks</span>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="pt-6 border-t">
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Ready to get started?</p>
              <p className="text-xs text-muted-foreground mb-3">
                Try creating your first task. Type anything in the search box above and press Enter.
              </p>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90 text-sm"
              >
                Start Creating Tasks
              </button>
            </div>
          </div>
        </div>
      </div>
    </DrawerWrapper>
  )
}
