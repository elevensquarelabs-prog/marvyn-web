import Link from 'next/link'

export const metadata = { title: 'Refund Policy – Marvyn' }

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#DA7756] flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm leading-none">M</span>
          </div>
          <span className="text-white font-semibold text-base tracking-tight">Marvyn</span>
        </Link>
        <Link href="/" className="text-sm text-[#555] hover:text-white transition-colors">← Back to home</Link>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-3">Marvyn · Legal</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Refund Policy</h1>
          <p className="text-sm text-[#555]">Effective date: March 25, 2026</p>
        </div>

        <div className="space-y-10 text-[#A0A0A0] leading-relaxed">
          <section>
            <p>
              This Refund Policy applies to paid Marvyn subscriptions and credit top-up purchases made through Eleven
              Square Labs. Because Marvyn relies on paid AI and third-party data providers, refunds are handled carefully
              and not all purchases are refundable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Subscription Refunds</h2>
            <p>
              Monthly subscription fees are generally non-refundable once the billing period has started. If you believe
              you were charged in error or experienced a verified critical service failure, email{' '}
              <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a>{' '}
              within 7 days of the charge and we will review the request.
            </p>
            <p>
              For annual subscriptions, refund requests made within 7 days of the initial purchase may be reviewed if
              the account has not made substantial use of paid features such as AI generation, data fetches, or publishing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Credit Top-Ups</h2>
            <p>
              Purchased credit packs are generally non-refundable once purchased. Credits are consumed by actions that
              trigger real provider costs, including AI generation and certain data operations.
            </p>
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
              <p className="text-sm text-[#C8C8D4]">
                Credit consumption may represent upstream costs paid by Marvyn to AI and data providers. Once those
                operations occur, that spend is not reversible.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Renewal Charges</h2>
            <p>
              Subscriptions renew automatically. If you intended to cancel but were charged on renewal, contact support
              within 48 hours. We may consider a goodwill refund if little or no paid usage occurred in the renewed period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Non-Refundable Situations</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Heavy use of AI generation, data fetches, or publishing before the refund request.</li>
              <li>Requests based solely on third-party platform outages, API restrictions, or policy changes.</li>
              <li>Account suspension caused by misuse, abuse, or policy violations.</li>
              <li>Consumed credit packs or materially used billing periods.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. How to Request a Refund</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Email <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a> with the subject line “Refund Request”.</li>
              <li>Include your registered email, charge date, amount, and reason for the request.</li>
              <li>We aim to respond within 5 business days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Cancellation vs Refund</h2>
            <p>
              Cancelling a subscription stops future renewals. It does not automatically create a refund for the current
              billing period or for previously purchased credits.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Privacy and Deletion Requests</h2>
            <p>
              Refund requests are separate from privacy or deletion requests. For deletion or data-rights requests,
              contact <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
            <p>
              Billing and refund support: <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a><br />
              Privacy and deletion requests: <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-[#333] mt-12">
        <p>© 2026 Eleven Square Labs. All rights reserved.</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <Link href="/privacy-policy" className="hover:text-[#555] transition-colors">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-[#555] transition-colors">Terms of Service</Link>
          <Link href="/cookie-policy" className="hover:text-[#555] transition-colors">Cookie Policy</Link>
          <Link href="/refund-policy" className="hover:text-[#555] transition-colors">Refund Policy</Link>
        </div>
      </footer>
    </div>
  )
}
