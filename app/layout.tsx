import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import "./globals.css"
import AuthProvider from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { GlobalModal } from "@/components/global-modal"

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Everling.io - Know before it matters",
  description: "The most minimal task manager that learns what matters to you. AI-powered relevance, daily digests, zero friction.",
  keywords: ["task manager", "minimal", "AI", "productivity", "email", "SMS"],
  icons: {
    icon: "/everling_logo_wb.png",
    shortcut: "/everling_logo_wb.png",
    apple: "/everling_logo_wb.png",
  },
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
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={spaceGrotesk.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
        <GlobalModal />
      </body>
    </html>
  )
}
