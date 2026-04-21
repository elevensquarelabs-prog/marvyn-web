import Link from 'next/link'

export const metadata = { title: 'Privacy Policy – Marvyn' }

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-sm text-[#555]">Effective date: March 25, 2026</p>
        </div>

        <div className="space-y-10 text-[#A0A0A0] leading-relaxed">
          <section>
            <p>
              This Privacy Policy explains how Marvyn, operated by <strong className="text-white">Eleven Square Labs</strong>,
              collects, uses, stores, and shares information when you use our website, application, and connected
              integrations. By using Marvyn, you agree to the practices described here.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              Marvyn is an AI-powered marketing workspace operated by Eleven Square Labs, 648/A OM Chambers, 4th Floor,
              Binnamangala 1st Stage, Indiranagar, Bangalore – 560038, India.
            </p>
            <p>
              General support: <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a><br />
              Privacy and data requests: <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <div className="space-y-5">
              <div>
                <h3 className="text-white font-medium mb-2">Account and authentication data</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Name, email address, and password when you register directly.</li>
                  <li>OAuth identity and profile metadata when you connect supported third-party platforms.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Billing and usage data</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Subscription status, plan, credit balances, top-ups, and usage records.</li>
                  <li>Payment references from Razorpay. We do not store full card or bank details.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Workspace and brand data</h3>
                <p>
                  Brand profile information, competitor lists, generated content, campaign notes, SEO data, analytics
                  preferences, alert settings, and any content you create or upload inside Marvyn.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Connected platform data</h3>
                <p>
                  When you connect Google, Meta, LinkedIn, Microsoft Clarity, or other supported services, we store
                  access tokens, refresh tokens where applicable, and operational metadata such as account IDs, page IDs,
                  customer IDs, site URLs, and GA4 property IDs.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Usage, logs, and support data</h3>
                <ul className="list-disc list-inside space-y-2">
                  <li>Feature usage, request logs, diagnostics, browser/device data, timestamps, and IP-related logs.</li>
                  <li>Support communications and account-related notifications.</li>
                  <li>Session and behavior analytics on Marvyn’s own website and app, as described below.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To operate, secure, and improve the Marvyn platform.</li>
              <li>To authenticate users, manage subscriptions, and administer credits.</li>
              <li>To connect to third-party platforms you authorize and fetch or publish data on your behalf.</li>
              <li>To generate AI-powered outputs using your prompts, workspace context, and connected data.</li>
              <li>To send transactional notifications, billing communications, and support responses.</li>
              <li>To diagnose incidents, prevent abuse, and comply with legal obligations.</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal data. We also do not use your connected platform data for our own advertising
              targeting beyond the actions you explicitly authorize inside Marvyn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. AI Processing and Model Providers</h2>
            <p>
              Marvyn routes AI requests through <strong className="text-white">OpenRouter</strong>, which may dispatch
              requests to downstream model providers such as Anthropic and Minimax. Prompts and relevant workspace context
              may be transmitted to OpenRouter and the selected model provider to generate outputs.
            </p>
            <p>
              We do not describe this as a direct single-provider integration because model routing may change over time.
              You remain responsible for reviewing all AI-generated outputs before publication, distribution, or business use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Platform Connections</h2>
            <div className="space-y-5">
              <div>
                <h3 className="text-white font-medium mb-2">Google</h3>
                <p className="mb-2">Marvyn uses the following Google scopes when authorized by you:</p>
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {['adwords', 'webmasters.readonly', 'analytics.readonly'].map(scope => (
                    <span key={scope} className="px-2 py-1 rounded border border-white/10 bg-white/5 text-[#888]">{scope}</span>
                  ))}
                </div>
                <ul className="list-disc list-inside space-y-2">
                  <li>Read Google Ads performance and selected customer-account data.</li>
                  <li>Read Google Search Console site and query performance data.</li>
                  <li>Read GA4 property, session, channel, conversion, and landing-page analytics.</li>
                </ul>
                <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/[0.03]">
                  <p className="text-sm font-medium text-white mb-2">How Google Data Is Displayed in the Product</p>
                  <p className="text-sm">
                    Data retrieved via Google APIs, including Google Ads, Google Search Console, and Google Analytics 4,
                    is displayed within user-facing Marvyn product surfaces such as the Ads workspace, SEO workspace,
                    Analytics dashboards, summaries, and reports. Users can view campaign metrics, traffic, engagement,
                    query performance, landing-page performance, and conversion insights directly inside the application.
                    We do not use Google user data outside these product features except as necessary for support,
                    security, legal compliance, and service operations consistent with applicable law and Google&apos;s policies.
                  </p>
                </div>
                <p className="mt-3">
                  Marvyn&apos;s use and transfer of information received from Google APIs will adhere to the Google API
                  Services User Data Policy, including the Limited Use requirements.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Meta</h3>
                <p className="mb-2">Marvyn uses these Meta permissions when authorized by you:</p>
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {['ads_read', 'ads_management', 'business_management'].map(scope => (
                    <span key={scope} className="px-2 py-1 rounded border border-white/10 bg-white/5 text-[#888]">{scope}</span>
                  ))}
                </div>
                <ul className="list-disc list-inside space-y-2">
                  <li>Fetch ad accounts, campaign insights, and page metadata.</li>
                  <li>Identify Instagram business accounts attached to connected Facebook pages.</li>
                  <li>Publish Facebook posts and Instagram posts or reels when initiated by you.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">LinkedIn</h3>
                <p className="mb-2">Marvyn uses these LinkedIn scopes when authorized by you:</p>
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {['openid', 'profile', 'email', 'w_member_social', 'r_ads'].map(scope => (
                    <span key={scope} className="px-2 py-1 rounded border border-white/10 bg-white/5 text-[#888]">{scope}</span>
                  ))}
                </div>
                <ul className="list-disc list-inside space-y-2">
                  <li>Identify your profile and save basic profile metadata.</li>
                  <li>Fetch LinkedIn ad accounts where available.</li>
                  <li>Publish LinkedIn UGC posts when you initiate publishing in Marvyn.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Shopify</h3>
                <p className="mb-2">When you connect your Shopify store to Marvyn, we access the following data via the Shopify Admin API using these scopes:</p>
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {['read_orders', 'read_products', 'read_customers', 'read_checkouts', 'read_discounts', 'read_price_rules', 'read_analytics'].map(scope => (
                    <span key={scope} className="px-2 py-1 rounded border border-white/10 bg-white/5 text-[#888]">{scope}</span>
                  ))}
                </div>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong className="text-white font-medium">Order data:</strong> Revenue, order count, average order value, refund rates, and purchase trends.</li>
                  <li><strong className="text-white font-medium">Product data:</strong> Top products by revenue and sales volume.</li>
                  <li><strong className="text-white font-medium">Customer data:</strong> New vs returning customer ratios and geographic distribution. We access aggregated metrics only — individual customer names, emails, and personal identifiers are never stored or used.</li>
                  <li><strong className="text-white font-medium">Checkout data:</strong> Abandoned checkout rates and estimated revenue lost.</li>
                  <li><strong className="text-white font-medium">Discount data:</strong> Discount codes, price rules, and per-code performance including order counts and revenue contribution.</li>
                  <li><strong className="text-white font-medium">Analytics data:</strong> Traffic source and UTM attribution as reported by Shopify.</li>
                </ul>
                <p className="mt-3">
                  Shopify data is used solely to generate marketing insights and recommendations within Marvyn. We do not
                  share, sell, or use your store data to train AI models or for any purpose beyond delivering the product
                  features you have authorised. You can disconnect your Shopify store at any time from Settings, which
                  removes Marvyn&apos;s access token. You may also revoke access directly from your Shopify admin under
                  Apps &amp; sales channels.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Microsoft Clarity</h3>
                <p>
                  If you connect Clarity, Marvyn reads project-level behavioral analytics including sessions, scroll depth,
                  dead clicks, rage clicks, and device/browser breakdowns.
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">DataForSEO</h3>
                <p>
                  Marvyn uses DataForSEO for SEO crawl, keyword, competitor, and SERP-related analysis. Domains, URLs,
                  and search-analysis inputs you submit may be sent to DataForSEO for processing.
                </p>
              </div>
            </div>
            <p className="mt-4">
              You can disconnect supported platforms from Settings. You may also revoke access directly from the provider’s
              own security or app-permissions controls.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Analytics and Tracking on Marvyn’s Own Website and App</h2>
            <p>
              Separate from customer-connected accounts, Marvyn may use first-party analytics and advertising technologies
              on its own website and application, including Microsoft Clarity, Google analytics or tagging, Meta Pixel,
              and LinkedIn Insight Tag, to understand product usage, measure campaigns, and improve the service.
            </p>
            <p>
              These tools may collect browser, device, interaction, page-view, and conversion-related information on
              Marvyn-owned properties. They do not grant us access to your third-party business accounts unless you
              separately connect those accounts inside the product.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies and Similar Technologies</h2>
            <p>
              We use cookies, local storage, pixels, tags, and similar technologies for authentication, preferences,
              analytics, and marketing measurement. See our{' '}
              <Link href="/cookie-policy" className="text-[#DA7756] hover:underline">Cookie Policy</Link> for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Storage, Security, and Retention</h2>
            <p>
              Marvyn stores account, workspace, and integration data in infrastructure that includes MongoDB and other
              supporting service providers. OAuth tokens and operational credentials are stored with access controls and
              used only to provide the features you authorize.
            </p>
            <p>
              We retain data for as long as necessary to provide the service, comply with legal obligations, resolve
              disputes, and enforce agreements. When accounts are deleted or platform connections are removed, related
              data is deleted or deactivated according to operational and legal requirements.
            </p>
            <p>
              We do not permit routine human review of individual connected-platform data, including Google user data,
              except where access is necessary for support requested by the user, security investigation, fraud
              prevention, legal compliance, or other internal operations permitted by applicable law and platform rules.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Your Rights and Data Deletion</h2>
            <p>You may request access, correction, deletion, or export-related assistance for your personal data.</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>General support: <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a></li>
              <li>Privacy and deletion requests: <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a></li>
            </ul>
            <p className="mt-3">
              Disconnecting a platform from Settings removes Marvyn’s active access for that integration. Some provider-side
              permissions may also need to be revoked directly from the provider dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. International Processing</h2>
            <p>
              Some of our processors and integrated platforms may process data outside India. By using Marvyn and
              connecting third-party services, you understand that information may be transferred internationally as
              necessary to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be communicated through the
              app, email, or both. Continued use of Marvyn after an update takes effect means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
            <p>
              Eleven Square Labs<br />
              648/A OM Chambers, 4th Floor, Binnamangala 1st Stage,<br />
              Indiranagar, Bangalore – 560038, India
            </p>
            <p>
              Support: <a href="mailto:support@marvyn.tech" className="text-[#DA7756] hover:underline">support@marvyn.tech</a><br />
              Data protection and deletion: <a href="mailto:dataofficer@marvyn.tech" className="text-[#DA7756] hover:underline">dataofficer@marvyn.tech</a>
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
