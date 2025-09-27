import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Don't redirect to setup if already has org (they shouldn't be here)
  // This will be handled by the setup page itself

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
