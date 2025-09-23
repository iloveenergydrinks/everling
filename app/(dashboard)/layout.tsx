import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { EmailProcessingIndicator } from "@/components/email-processing-indicator"
import { DiscordProcessingIndicator } from "@/components/discord-processing-indicator"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
      <EmailProcessingIndicator />
      <DiscordProcessingIndicator />
    </div>
  )
}