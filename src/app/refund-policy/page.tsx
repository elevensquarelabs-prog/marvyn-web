import Link from 'next/link'

export const metadata = { title: 'Refund Policy – Marvyn' }

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="font-bold text-lg tracking-tight">Marvyn</span>
        <Link href="/" className="text-sm text-[#555] hover:text-white transition-colors">← Back to home</Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
        <p className="text-[#555] text-sm mb-10">Effective date: March 23, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A0A0A0] leading-relaxed">

          <section>
            <p>
              This Refund Policy applies to all subscriptions purchased on the Marvyn platform, operated by{' '}
              <strong className="text-white">Eleven Square Labs</strong> (648/A OM Chambers, 4th Floor,
              Binnamangala 1st Stage, Indiranagar, Bangalore – 560038, India).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Free Trial</h2>
            <p>
              Marvyn offers a <strong className="text-white">14-day free trial</strong> to all new users.
              No payment information is required during the trial period. You can explore all features
              before committing to a paid subscription. We strongly encourage you to use the trial period
              to evaluate the platform before purchasing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Subscription Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <p className="text-white font-semibold text-lg">₹699 / month</p>
                <p className="text-sm mt-1">Monthly subscription. Billed every 30 days. Cancel anytime.</p>
              </div>
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <p className="text-white font-semibold text-lg">₹4,999 / year</p>
                <p className="text-sm mt-1">Annual subscription. Billed once per year. Save ~40% vs monthly.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Refund Eligibility</h2>
            <p>We offer refunds under the following conditions:</p>
            <ul className="list-disc list-inside space-y-3 mt-3">
              <li>
                <strong className="text-white">Monthly plans:</strong> Refunds are available within{' '}
                <strong className="text-white">7 days</strong> of the billing date if you have not
                significantly used the platform during that period (fewer than 5 audit runs, fewer than
                10 AI content generations).
              </li>
              <li>
                <strong className="text-white">Annual plans:</strong> Refunds are available within{' '}
                <strong className="text-white">14 days</strong> of the initial purchase date, subject
                to the same usage limits above. Partial refunds (pro-rated for unused months) may be
                considered on a case-by-case basis after the 14-day window.
              </li>
              <li>
                <strong className="text-white">Technical failure:</strong> If you experience a critical
                technical issue that renders the platform unusable and we are unable to resolve it within
                72 hours, you are entitled to a full refund regardless of usage.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Non-Refundable Situations</h2>
            <p>Refunds will not be issued in the following cases:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>You changed your mind after using the platform beyond the usage limits stated above.</li>
              <li>Your account was suspended or terminated due to a violation of our Terms of Service.</li>
              <li>You did not use your free trial before purchasing.</li>
              <li>Requests made after the refund window has expired (beyond 7 days for monthly, 14 days for annual).</li>
              <li>Disruptions caused by third-party services (Meta, Google, LinkedIn) that are outside our control.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. How to Request a Refund</h2>
            <p>To request a refund:</p>
            <ol className="list-decimal list-inside space-y-2 mt-3">
              <li>
                Email us at{' '}
                <a href="mailto:support@elevensquarelabs.com" className="text-[#DA7756] hover:underline">
                  support@elevensquarelabs.com
                </a>{' '}
                with the subject line <strong className="text-white">&quot;Refund Request – [Your Email]&quot;</strong>.
              </li>
              <li>Include your registered email address, the date of purchase, and the reason for your request.</li>
              <li>We will respond within <strong className="text-white">3 business days</strong>.</li>
              <li>
                Approved refunds are processed back to your original payment method within{' '}
                <strong className="text-white">7–10 business days</strong>, depending on your bank or card issuer.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Cancellations</h2>
            <p>
              You can cancel your subscription at any time from your account settings. Cancellation stops
              future billing but does not automatically trigger a refund for the current billing period.
              Your access continues until the end of the paid period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Currency and Taxes</h2>
            <p>
              All transactions are in Indian Rupees (INR). Refunds will be issued in INR. Eleven Square Labs
              is not responsible for any currency conversion losses or bank charges incurred during the
              refund process.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Changes to This Policy</h2>
            <p>
              We reserve the right to update this Refund Policy at any time. Changes will be posted on this
              page with a new effective date. The policy in effect at the time of your purchase governs
              your refund eligibility.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact Us</h2>
            <p>For refund requests or billing questions:</p>
            <p className="mt-3">
              Eleven Square Labs<br />
              648/A OM Chambers, 4th Floor, Binnamangala 1st Stage,<br />
              Indiranagar, Bangalore – 560038, India<br />
              <a href="mailto:support@elevensquarelabs.com" className="text-[#DA7756] hover:underline">support@elevensquarelabs.com</a>
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
