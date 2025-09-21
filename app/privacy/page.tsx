export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-3xl px-6 space-y-8">
        <div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to home</a>
        </div>
        <header>
          <h1 className="text-2xl font-semibold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <section className="space-y-3 text-sm leading-6">
          <p>
            Everling.io ("we", "our", "us") provides a task management service that can
            create and organize tasks from inbound email and manual input. This policy
            explains what data we collect, how we use it, and your choices.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Information we collect</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Account information (name, email) and authentication data.</li>
            <li>Task data you create or forward via email (title, description, dates, metadata).</li>
            <li>Integration tokens if you connect third‑party services (e.g., Google Calendar).</li>
            <li>Operational logs for security and reliability.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">How we use information</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>To provide and improve the service (task creation, reminders, search).</li>
            <li>To send notifications and reminders you configure.</li>
            <li>To process integrations you explicitly enable (e.g., add events to your calendar).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Third‑party services</h2>
          <p className="text-sm">
            If you connect third‑party services, we use their APIs only for the purposes you
            enable (e.g., creating/updating calendar events). Access/refresh tokens are stored
            securely and can be revoked at any time from Integrations or your provider settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Data retention</h2>
          <p className="text-sm">
            We retain account and task data while your account is active. You may request
            deletion of your account and associated data at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Your choices</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Disconnect integrations or revoke access from provider dashboards.</li>
            <li>Export or delete your tasks by contacting support.</li>
            <li>Adjust notification preferences in Settings.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Contact</h2>
          <p className="text-sm">For privacy questions or requests, contact support@everling.io</p>
        </section>
      </div>
    </div>
  )
}


