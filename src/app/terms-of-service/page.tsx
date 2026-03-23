import Link from 'next/link'

export const metadata = { title: 'Terms of Service – Marvyn' }

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="font-bold text-lg tracking-tight">Marvyn</span>
        <Link href="/" className="text-sm text-[#555] hover:text-white transition-colors">← Back to home</Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-[#555] text-sm mb-10">Effective date: March 23, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A0A0A0] leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Marvyn ("the Platform"), you agree to be bound by these Terms of Service.
              The Platform is operated by <strong className="text-white">Eleven Square Labs</strong> (648/A OM Chambers,
              4th Floor, Binnamangala 1st Stage, Indiranagar, Bangalore – 560038, India). If you do not agree
              to these terms, do not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              Marvyn is an AI-powered Marketing Operating System that helps businesses manage campaigns,
              generate content, analyse SEO, and get AI-driven marketing insights. The Platform integrates
              with third-party services including Meta Ads, Google Ads, Google Search Console, and LinkedIn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Eligibility</h2>
            <p>
              You must be at least 18 years old and have the legal capacity to enter into a binding contract
              to use the Platform. By using Marvyn, you represent and warrant that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Account Registration</h2>
            <p>
              You must create an account to use the Platform. You are responsible for maintaining the
              confidentiality of your login credentials and for all activities that occur under your account.
              Notify us immediately at{' '}
              <a href="mailto:support@elevensquarelabs.com" className="text-[#DA7756] hover:underline">support@elevensquarelabs.com</a>{' '}
              if you suspect unauthorised access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Subscriptions and Billing</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Marvyn is offered on a subscription basis at <strong className="text-white">₹699/month</strong> or <strong className="text-white">₹4,999/year</strong>.</li>
              <li>A <strong className="text-white">14-day free trial</strong> is available to new users. No payment is required during the trial.</li>
              <li>Subscriptions auto-renew at the end of each billing period unless cancelled.</li>
              <li>Payments are processed securely through Razorpay. All prices are in Indian Rupees (INR) and inclusive of applicable taxes.</li>
              <li>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Refunds</h2>
            <p>
              Please refer to our{' '}
              <Link href="/refund-policy" className="text-[#DA7756] hover:underline">Refund Policy</Link>{' '}
              for details on eligibility and process.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorised access to any part of the Platform or its infrastructure.</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Platform.</li>
              <li>Resell, sublicense, or redistribute the Platform without prior written consent.</li>
              <li>Use the Platform to generate spam, misleading content, or material that violates third-party platform policies.</li>
              <li>Interfere with or disrupt the integrity or performance of the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Third-Party Integrations</h2>
            <p>
              When you connect third-party services (Meta, Google, LinkedIn), you grant Marvyn permission to
              access your data on those platforms in accordance with their respective terms of service and
              your authorisation. We are not responsible for the availability, accuracy, or policies of
              third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. AI-Generated Content</h2>
            <p>
              Marvyn uses AI to generate marketing content, insights, and recommendations. You acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>AI-generated content may be inaccurate or incomplete and should be reviewed before use.</li>
              <li>You are solely responsible for any content you publish or act upon based on AI suggestions.</li>
              <li>Eleven Square Labs makes no warranties regarding the accuracy or fitness of AI-generated outputs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Intellectual Property</h2>
            <p>
              All intellectual property rights in the Platform, including software, design, and content created
              by Eleven Square Labs, remain our exclusive property. You retain ownership of all data and content
              you submit to or create through the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Eleven Square Labs shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including loss of profits, data, or
              goodwill, arising from your use of the Platform. Our total liability shall not exceed the amount
              paid by you in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided "as is" and "as available" without any warranties of any kind, express
              or implied. We do not warrant that the Platform will be uninterrupted, error-free, or free of
              viruses or other harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of these
              Terms or for any other reason with notice. Upon termination, your right to use the Platform
              ceases immediately. You may delete your account at any time from account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">14. Governing Law</h2>
            <p>
              These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive
              jurisdiction of the courts in Bangalore, Karnataka, India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Changes to Terms</h2>
            <p>
              We may update these Terms at any time. We will notify you of material changes via email or
              in-app notice. Continued use of the Platform after changes constitutes your acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">16. Contact</h2>
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
