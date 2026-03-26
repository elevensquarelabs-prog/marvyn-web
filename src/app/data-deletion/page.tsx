import Link from 'next/link'

export const metadata = { title: 'Data Deletion Instructions – Marvyn' }

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between border-b border-white/5 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#DA7756]">
            <span className="text-sm font-black leading-none text-white">M</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-white">Marvyn</span>
        </Link>
        <Link href="/" className="text-sm text-[#555] transition-colors hover:text-white">← Back to home</Link>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10">
          <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[#666]">Marvyn · Legal</p>
          <h1 className="mb-3 text-3xl font-black tracking-tight md:text-4xl">User Data Deletion Instructions</h1>
          <p className="text-sm text-[#555]">Use this page for Facebook / Meta app review and customer-facing deletion requests.</p>
        </div>

        <div className="space-y-8 text-[#A0A0A0] leading-relaxed">
          <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
            <h2 className="mb-3 text-xl font-semibold text-white">How to request deletion</h2>
            <p>
              If you want Marvyn to delete your account data or any connected platform data, email{' '}
              <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>{' '}
              from the email address associated with your Marvyn account.
            </p>
            <p className="mt-3">
              Please include:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>Your full name</li>
              <li>Your Marvyn account email address</li>
              <li>The platform connection you want removed, if applicable, such as Facebook, Instagram, Google, or LinkedIn</li>
              <li>A short note confirming whether you want only the connected-platform data removed or the full Marvyn account deleted</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">What Marvyn will delete</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>Connected Facebook / Meta access tokens and account metadata stored in Marvyn</li>
              <li>Connected Instagram, Google, LinkedIn, GA4, Search Console, and Clarity connection metadata stored in Marvyn</li>
              <li>Associated account-level workspace data when you request full account deletion</li>
              <li>Operational records retained only where required for security, billing, fraud prevention, or legal compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">How to disconnect Meta / Facebook access yourself</h2>
            <p>
              If you connected Facebook or Instagram to Marvyn, you can also remove Marvyn access directly from your Facebook account settings.
            </p>
            <ol className="mt-3 list-inside list-decimal space-y-2">
              <li>Log in to your Facebook account</li>
              <li>Open <span className="text-white">Settings & privacy → Settings → Business Integrations</span></li>
              <li>Select <span className="text-white">Marvyn</span></li>
              <li>Remove the integration</li>
            </ol>
            <p className="mt-3">
              Removing the integration from Facebook revokes future access. If you also want Marvyn-stored data deleted, send the deletion request email above.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Product-side deletion path</h2>
            <p>
              Inside Marvyn, users can remove supported platform connections from the Settings area. That disconnects access for future use. For permanent deletion of stored connection data or full account deletion, email{' '}
              <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-white">Support and policy links</h2>
            <p>
              General support: <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a><br />
              Privacy and deletion requests: <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#666]">
              <Link href="/privacy-policy" className="transition-colors hover:text-[#DA7756]">Privacy Policy</Link>
              <Link href="/terms-of-service" className="transition-colors hover:text-[#DA7756]">Terms of Service</Link>
              <Link href="/cookie-policy" className="transition-colors hover:text-[#DA7756]">Cookie Policy</Link>
              <Link href="/refund-policy" className="transition-colors hover:text-[#DA7756]">Refund Policy</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
