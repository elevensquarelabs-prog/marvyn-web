type Plan = {
  name: string
  key: string
  price: string
  credits: number
  agentChatsPerMonth: number
  features: string[]
}

const PLAN_TONES: Record<string, string> = {
  starter: 'from-[#9B482A] to-[#D97757] text-white border-[#D7A08B]',
  pro: 'from-[#7F4F3F] to-[#B97A5E] text-white border-[#C8A690]',
  beta: 'from-[#15594F] to-[#0D8C79] text-white border-[#7FCABB]',
}

export function AdminPlansShell({
  plans,
  creditReference,
}: {
  plans: Plan[]
  creditReference: Array<[string, string]>
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
      <div className="mb-10 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9C7A6E]">
          Admin plans
        </p>
        <div className="space-y-2">
          <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-[-0.04em] text-[#221814] sm:text-5xl">
            Plans
          </h1>
          <p className="text-sm leading-6 text-[#7C6258]">
            Credit allocation and plan definitions
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map(plan => (
          <section
            key={plan.key}
            className={`rounded-[1.75rem] border bg-gradient-to-br p-6 shadow-[0_20px_60px_rgba(73,40,28,0.08)] ${PLAN_TONES[plan.key] ?? 'from-[#9B482A] to-[#D97757] text-white border-[#D7A08B]'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                  {plan.name}
                </p>
                <div className="mt-3 text-lg font-semibold">{plan.price}</div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-semibold tracking-[-0.04em]">{plan.credits}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/70">
                  credits/mo
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85">
              {plan.agentChatsPerMonth} agent chats per month
            </div>

            <ul className="mt-6 space-y-3">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-start gap-3 text-sm text-white/84">
                  <span className="mt-0.5 text-white">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#E6D8CF] bg-white/88 shadow-[0_20px_60px_rgba(73,40,28,0.08)]">
        <div className="border-b border-[#EEE2DA] bg-[#FCF8F4] px-6 py-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6E544A]">
            Credit Cost Reference
          </h2>
        </div>

        <div className="grid gap-x-10 gap-y-0 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {creditReference.map(([feature, cost]) => (
            <div
              key={feature}
              className="flex items-center justify-between border-b border-[#F1E7E0] py-4 text-sm"
            >
              <span className="font-medium text-[#6F564C]">{feature}</span>
              <span className="font-semibold text-[#2B1C17]">{cost}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
