import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import AuthProvider from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { GlobalModal } from "@/components/global-modal"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Everling.io - Know before it matters",
  description: "The most minimal task manager that learns what matters to you. AI-powered relevance, daily digests, zero friction.",
  keywords: ["task manager", "minimal", "AI", "productivity", "email", "SMS"],
  openGraph: {
    title: "Everling.io - Know before it matters",
    description: "Minimalism meets intelligence. The task manager that learns what matters to you.",
    url: "https://everling.io",
    siteName: "Everling.io",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Everling.io - Know before it matters",
    description: "The most minimal task manager that learns what matters to you.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
        <GlobalModal />
      </body>
    </html>
  )
}
