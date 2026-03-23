import Link from 'next/link'

export const metadata = { title: 'Cookie Policy – Marvyn' }

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="font-bold text-lg tracking-tight">Marvyn</span>
        <Link href="/" className="text-sm text-[#555] hover:text-white transition-colors">← Back to home</Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-[#555] text-sm mb-10">Effective date: March 23, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A0A0A0] leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files placed on your device when you visit a website. They help websites
              remember your preferences, keep you logged in, and collect analytics data. Marvyn, operated by
              <strong className="text-white"> Eleven Square Labs</strong>, uses cookies and similar technologies
              as described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Types of Cookies We Use</h2>

            <div className="space-y-5 mt-3">
              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <h3 className="text-white font-medium mb-1">Essential Cookies</h3>
                <p className="text-sm">
                  Required for the Platform to function. These include session cookies for authentication
                  (keeping you logged in), CSRF protection tokens, and preference cookies. These cannot be
                  disabled without breaking core functionality.
                </p>
                <p className="text-xs text-[#555] mt-2">Examples: <code className="text-[#888]">next-auth.session-token</code>, <code className="text-[#888]">next-auth.csrf-token</code></p>
              </div>

              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <h3 className="text-white font-medium mb-1">Analytics Cookies</h3>
                <p className="text-sm">
                  Help us understand how users interact with the Platform so we can improve it.
                  We use aggregated, anonymised data only. If you have connected Microsoft Clarity,
                  session recording cookies may also be set.
                </p>
                <p className="text-xs text-[#555] mt-2">Third party: Microsoft Clarity (if connected by you)</p>
              </div>

              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <h3 className="text-white font-medium mb-1">Preference Cookies</h3>
                <p className="text-sm">
                  Remember your settings and preferences within the Platform, such as selected date ranges,
                  UI preferences, and dismissed banners.
                </p>
              </div>

              <div className="p-4 bg-[#111] border border-[#1E1E1E] rounded-xl">
                <h3 className="text-white font-medium mb-1">Third-Party Cookies</h3>
                <p className="text-sm">
                  Some third-party services we integrate with may set their own cookies when you authenticate
                  or interact with their features (e.g., Google OAuth, Meta OAuth). These are governed by
                  the respective third parties' cookie policies.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How Long Do Cookies Last?</h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border border-[#1E1E1E] rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-[#111] border-b border-[#1E1E1E]">
                    <th className="text-left px-4 py-3 text-white font-medium">Cookie</th>
                    <th className="text-left px-4 py-3 text-white font-medium">Purpose</th>
                    <th className="text-left px-4 py-3 text-white font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E1E1E]">
                  {[
                    ['next-auth.session-token', 'Authentication session', '30 days'],
                    ['next-auth.csrf-token', 'Security (CSRF protection)', 'Session'],
                    ['next-auth.callback-url', 'OAuth redirect handling', 'Session'],
                    ['Clarity cookies', 'Session recording & heatmaps', 'Up to 1 year'],
                  ].map(([name, purpose, duration]) => (
                    <tr key={name} className="hover:bg-[#111]/50">
                      <td className="px-4 py-3 font-mono text-xs text-[#888]">{name}</td>
                      <td className="px-4 py-3">{purpose}</td>
                      <td className="px-4 py-3 text-[#DA7756]">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Managing Cookies</h2>
            <p>
              You can control and delete cookies through your browser settings. Note that disabling essential
              cookies will prevent you from logging in and using the Platform. Here are links to cookie
              management guides for common browsers:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Google Chrome: Settings → Privacy and security → Cookies</li>
              <li>Mozilla Firefox: Options → Privacy & Security → Cookies and Site Data</li>
              <li>Safari: Preferences → Privacy → Manage Website Data</li>
              <li>Microsoft Edge: Settings → Cookies and site permissions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Do Not Track</h2>
            <p>
              Some browsers offer a "Do Not Track" signal. We currently do not alter our data collection
              practices in response to DNT signals, as there is no universal standard for interpreting them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. We will post changes on this page with
              a new effective date. Continued use of the Platform constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact</h2>
            <p>
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
