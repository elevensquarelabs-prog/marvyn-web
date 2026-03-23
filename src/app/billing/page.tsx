import Link from 'next/link'

export default function BillingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
      <div className="text-center max-w-sm px-4">
        <div className="w-10 h-10 bg-[#DA7756] rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">M</div>
        <h1 className="text-xl font-semibold text-white mb-2">Trial Expired</h1>
        <p className="text-sm text-[#555] mb-6">Your 14-day free trial has ended. Upgrade to continue using Marvyn.</p>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-[#DA7756] hover:bg-[#C4633F] text-white text-sm font-medium rounded-lg transition-colors"
        >
          View Plans
        </Link>
      </div>
    </div>
  )
}
