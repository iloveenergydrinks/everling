import { redirect } from "next/navigation"

export default function EmailsPage() {
  // For now, redirect to dashboard
  // This can be expanded later to show email logs
  redirect("/dashboard")
}
