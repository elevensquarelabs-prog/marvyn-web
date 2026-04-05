export default function PlansPage() {
  const plans = [
    {
      name: 'Starter',
      key: 'starter',
      price: '₹799/month',
      credits: 150,
      agentChatsPerMonth: 18,
      features: ['18 agent chats/month', '50 copy generations', '18 blog posts', '12 SEO audits', '8 competitor analyses'],
    },
    {
      name: 'Pro',
      key: 'pro',
      price: '₹1,499/month',
      credits: 400,
      agentChatsPerMonth: 50,
      features: ['50 agent chats/month', '133 copy generations', '50 blog posts', '33 SEO audits', '22 competitor analyses'],
    },
    {
      name: 'Beta',
      key: 'beta',
      price: 'Free (beta)',
      credits: 300,
      agentChatsPerMonth: 37,
      features: ['37 agent chats/month', 'All features', 'Beta access'],
    },
  ]

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Plans</h1>
        <p className="text-zinc-500 text-sm mt-1">Credit allocation and plan definitions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map(plan => (
          <div key={plan.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-white font-semibold">{plan.name}</div>
                <div className="text-violet-400 text-sm font-medium mt-0.5">{plan.price}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{plan.credits}</div>
                <div className="text-xs text-zinc-500">credits/mo</div>
              </div>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map(f => (
                <li key={f} className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-3">Credit Cost Reference</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2">
          {[
            ['Agent Chat', '8 credits'],
            ['Blog Generate', '8 credits'],
            ['SEO Run', '30 credits'],
            ['Competitor Analysis', '18 credits'],
            ['SEO Audit', '12 credits'],
            ['Copy Generate', '3 credits'],
            ['Social Generate', '2 credits'],
            ['Strategy Plan', '6 credits'],
          ].map(([feature, cost]) => (
            <div key={feature} className="flex justify-between text-xs py-1 border-b border-zinc-800">
              <span className="text-zinc-400">{feature}</span>
              <span className="text-zinc-300 font-medium">{cost}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
