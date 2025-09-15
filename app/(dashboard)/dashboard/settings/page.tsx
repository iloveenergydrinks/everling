import { redirect } from "next/navigation"

export default function SettingsPage() {
  // For now, redirect to dashboard
  // This can be expanded later for user settings
  redirect("/dashboard")
}
