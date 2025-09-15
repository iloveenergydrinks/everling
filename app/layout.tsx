import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import "./globals.css"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import AuthProvider from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { GlobalModal } from "@/components/global-modal"

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: "TaskManager - Email to Task Automation",
  description: "Convert emails into actionable tasks automatically with AI",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={spaceGrotesk.className}>
        <AuthProvider session={session}>
          {children}
          <Toaster />
          <GlobalModal />
        </AuthProvider>
      </body>
    </html>
  )
}