export default function TermsPage() {
  return (
    <div className="min-h-screen py-12">
      <div className="mx-auto max-w-3xl px-6 space-y-8">
        <div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to home</a>
        </div>
        <header>
          <h1 className="text-2xl font-semibold">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </header>

        <section className="space-y-3 text-sm leading-6">
          <p>
            By using Everling.io, you agree to these Terms. If you do not agree, do not use
            the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Use of service</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>You are responsible for your account and the content you submit.</li>
            <li>Do not misuse the service (abuse, unauthorized access, unlawful content).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Integrations</h2>
          <p className="text-sm">
            You may connect third‑party services (e.g., Google Calendar). You authorize us to
            act on your behalf to create/update items as configured. You can disconnect at any
            time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Disclaimer</h2>
          <p className="text-sm">
            The service is provided "as is" without warranties of any kind. We are not
            responsible for missed reminders or scheduling conflicts.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Limitation of liability</h2>
          <p className="text-sm">
            To the maximum extent permitted by law, Everling.io shall not be liable for any
            indirect, incidental, special, consequential or punitive damages.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Termination</h2>
          <p className="text-sm">
            You may stop using the service at any time. We may suspend or terminate access for
            violations of these Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Contact</h2>
          <p className="text-sm">support@everling.io</p>
        </section>
      </div>
    </div>
  )
}


