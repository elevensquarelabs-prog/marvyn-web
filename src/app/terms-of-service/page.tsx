import Link from 'next/link'

export const metadata = { title: 'Terms of Service – Marvyn' }

export default function TermsOfService() {
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Terms of Service</h1>
          <p className="text-sm text-[#555]">Effective date: March 25, 2026</p>
        </div>

        <div className="space-y-10 text-[#A0A0A0] leading-relaxed">
          <section>
            <p>
              These Terms of Service govern your access to and use of Marvyn, operated by
              <strong className="text-white"> Eleven Square Labs</strong>. By creating an account or using the service,
              you agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Service Description</h2>
            <p>
              Marvyn is an AI-powered marketing workspace for businesses. It helps users manage content, SEO, ads,
              analytics, social publishing, and reporting across connected third-party platforms including Google,
              Meta, LinkedIn, Microsoft Clarity, and DataForSEO.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Accounts and Eligibility</h2>
            <p>
              You must be legally able to enter into a binding contract and must provide accurate account information.
              You are responsible for safeguarding your credentials and for all activity under your account.
            </p>
            <p>
              If you suspect unauthorized access, contact <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Acceptable Use</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Do not use Marvyn for unlawful, deceptive, harmful, or fraudulent activity.</li>
              <li>Do not attempt to bypass usage controls, credits, access restrictions, or platform safeguards.</li>
              <li>Do not misuse third-party APIs or connected accounts through Marvyn.</li>
              <li>Do not publish content that violates platform rules, law, or third-party rights.</li>
              <li>Do not overload, scrape, reverse engineer, or otherwise abuse the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Connected Third-Party Accounts</h2>
            <p>
              When you connect Google, Meta, LinkedIn, Clarity, or other supported services, you confirm that you have
              authority to authorize access for the relevant account or business. You are responsible for your use of
              those connected accounts and for any content or actions initiated from Marvyn.
            </p>
            <p>
              Third-party services operate under their own policies and APIs. Marvyn is not responsible for outages,
              restrictions, permission changes, or policy changes imposed by those platforms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. AI-Generated Content</h2>
            <p>
              Marvyn uses AI model providers, including Anthropic, to generate marketing outputs, analysis, and
              recommendations. AI outputs may be inaccurate, incomplete, or unsuitable for your particular use case.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>You are solely responsible for reviewing, editing, and approving outputs before use or publication.</li>
              <li>We do not guarantee the accuracy, legality, or commercial fitness of AI-generated results.</li>
              <li>Model availability and output quality may change over time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Subscriptions, Credits, and Billing</h2>
            <p>
              Marvyn offers paid subscriptions and may offer credit top-ups for AI and data-intensive features. Current
              pricing is presented in the product at the time of purchase. Payments are processed by Razorpay.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Subscriptions renew automatically unless cancelled before renewal.</li>
              <li>Credits are consumed by eligible product actions and do not have cash value.</li>
              <li>Top-up credits are non-transferable and may be governed by additional in-product pricing rules.</li>
            </ul>
            <p className="mt-3">
              See our <Link href="/refund-policy" className="text-[#DA7756] hover:underline">Refund Policy</Link> for refund details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Suspension and Termination</h2>
            <p>
              We may suspend or terminate access if you violate these Terms, abuse the platform, misuse connected APIs,
              create legal or operational risk, or if required by law. You may stop using Marvyn at any time and may
              cancel subscriptions from the product settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>
              Eleven Square Labs retains ownership of the Marvyn software, product design, and related intellectual
              property. You retain ownership of your original business data and content. You grant us a limited right
              to process that data only as needed to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Disclaimer and Limitation of Liability</h2>
            <p>
              Marvyn is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted by law, we
              disclaim warranties of availability, accuracy, and fitness for a particular purpose.
            </p>
            <p>
              We are not liable for indirect, incidental, consequential, or special damages, including lost profits,
              data loss, or business interruption. Our aggregate liability will not exceed the amount you paid to us in
              the 3 months before the claim arose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of India. Courts in Bangalore, Karnataka, India will have exclusive
              jurisdiction over disputes arising from these Terms or your use of Marvyn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
            <p>
              Support: <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a><br />
              Privacy and deletion requests: <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>
            </p>
            <p>
              Eleven Square Labs<br />
              648/A OM Chambers, 4th Floor, Binnamangala 1st Stage,<br />
              Indiranagar, Bangalore – 560038, India
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
