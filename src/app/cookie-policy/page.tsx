import Link from 'next/link'

export const metadata = { title: 'Cookie Policy – Marvyn' }

export default function CookiePolicy() {
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Cookie Policy</h1>
          <p className="text-sm text-[#555]">Effective date: March 25, 2026</p>
        </div>

        <div className="space-y-10 text-[#A0A0A0] leading-relaxed">
          <section>
            <p>
              This Cookie Policy explains how Marvyn uses cookies, pixels, tags, and similar technologies on Marvyn’s
              own website and application. It does not govern cookies or tracking used by third-party platforms you
              connect inside Marvyn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Essential Cookies</h2>
            <p>
              These cookies are required for core functionality such as login, session continuity, CSRF protection, and
              OAuth handshakes. Disabling them may prevent Marvyn from working properly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Preference Cookies</h2>
            <p>
              These cookies remember product settings such as interface preferences, dismissed banners, or other
              convenience choices so you do not need to reset them every visit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Analytics and Behavior Technologies</h2>
            <p>
              Marvyn may use analytics technologies such as Microsoft Clarity and Google analytics or tagging on its own
              website and app to understand traffic, sessions, interactions, and user friction. These technologies may
              collect information like browser type, device information, page views, clicks, session behavior, and
              conversion-related events.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Microsoft Clarity</li>
              <li>Google Analytics 4 and related Google tags where implemented</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Marketing and Advertising Technologies</h2>
            <p>
              Marvyn may use tools such as Meta Pixel and LinkedIn Insight Tag on its own marketing properties to
              measure campaign effectiveness, conversion events, and remarketing performance for Marvyn’s own business.
            </p>
            <p>
              These tools are distinct from customer-authorized third-party platform connections inside the Marvyn app.
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Meta Pixel</li>
              <li>LinkedIn Insight Tag</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Consent</h2>
            <p>
              Essential cookies do not require consent where they are strictly necessary. For analytics, preference, and
              marketing technologies, we seek consent where required by applicable law. If a consent banner is shown,
              your selections will govern the relevant categories.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Managing Cookies</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Browser settings let you block or delete cookies.</li>
              <li>You may use provider opt-out tools where available.</li>
              <li>Blocking essential cookies may impair authentication and core platform functions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Third-Party Policies</h2>
            <p>
              Data collected by external analytics and advertising tools is also subject to the respective provider’s
              own policies, including those of Google, Meta, LinkedIn, and Microsoft.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact</h2>
            <p>
              For cookie or privacy-related questions, contact{' '}
              <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>.
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
