import StatCard from '@/components/admin/StatCard'

export interface DashboardData {
  totalUsers: number
  activeUsers: number
  byPlan: Record<string, number>
  totalCostUsd: number
  totalCostInr: number
  totalCreditsUsed: number
  totalApiCalls: number
  mrrInr: number
}

const PLAN_META = [
  { key: 'starter', label: 'Starter', tone: 'bg-[#D97757]' },
  { key: 'pro', label: 'Pro', tone: 'bg-[#7F4F3F]' },
  { key: 'beta', label: 'Beta', tone: 'bg-[#0D8C79]' },
  { key: 'none', label: 'None', tone: 'bg-[#C9B3A7]' },
]

export function AdminDashboardShell({
  data,
  currentMonth,
}: {
  data: DashboardData
  currentMonth: string
}) {
  const totalPlanUsers = Object.values(data.byPlan).reduce((sum, count) => sum + count, 0)

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#9C7A6E]">
            Admin overview
          </p>
          <div className="space-y-2">
            <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-[-0.04em] text-[#221814] sm:text-5xl">
              Dashboard
            </h1>
            <p className="text-sm leading-6 text-[#7C6258]">
              Live view of revenue, usage, and plan mix across the admin workspace.
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center rounded-full border border-[#E3D2C9] bg-white/70 px-4 py-2 text-sm font-medium text-[#6E544A] shadow-sm">
          {currentMonth}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={`₹${data.mrrInr.toLocaleString('en-IN')}`}
          sub="Active subscriptions"
          accent
        />
        <StatCard
          label="Total users"
          value={data.totalUsers.toLocaleString('en-IN')}
          sub={`${data.activeUsers} active this month`}
        />
        <StatCard
          label="AI cost"
          value={`₹${data.totalCostInr.toLocaleString('en-IN')}`}
          sub={`$${data.totalCostUsd.toFixed(2)} billed`}
        />
        <StatCard
          label="API calls"
          value={data.totalApiCalls.toLocaleString('en-IN')}
          sub={`${data.totalCreditsUsed.toLocaleString('en-IN')} credits used`}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[1.75rem] border border-[#E6D8CF] bg-white/85 p-6 shadow-[0_20px_60px_rgba(73,40,28,0.08)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#9C7A6E]">
                Plan distribution
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-geist-sans)] text-2xl font-semibold tracking-[-0.03em] text-[#231814]">
                Users by plan
              </h2>
            </div>
            <div className="rounded-full bg-[#F8EEE8] px-3 py-1 text-xs font-medium text-[#7D6156]">
              {totalPlanUsers} total accounts
            </div>
          </div>

          <div className="space-y-4">
            {PLAN_META.map(plan => {
              const count = data.byPlan[plan.key] ?? 0
              const pct = totalPlanUsers > 0 ? Math.round((count / totalPlanUsers) * 100) : 0

              return (
                <div key={plan.key} className="rounded-2xl border border-[#EEE2DA] bg-[#FFF9F5] p-4">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${plan.tone}`} />
                      <span className="text-sm font-semibold text-[#2E211C]">{plan.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-[#2E211C]">{count}</div>
                      <div className="text-xs text-[#907468]">{pct}% of users</div>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F0E3DB]">
                    <div
                      className={`h-full rounded-full ${plan.tone}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#E6D8CF] bg-[#2B1C17] p-6 text-[#FFF7F3] shadow-[0_20px_60px_rgba(43,28,23,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#E8BFAE]">
            Operational summary
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-geist-sans)] text-2xl font-semibold tracking-[-0.03em]">
            Current month at a glance
          </h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#E8BFAE]">
                Active coverage
              </div>
              <div className="mt-2 text-3xl font-semibold">
                {data.totalUsers === 0 ? '0%' : `${Math.round((data.activeUsers / data.totalUsers) * 100)}%`}
              </div>
              <p className="mt-2 text-sm text-[#F8DDD3]/72">
                {data.activeUsers} of {data.totalUsers} users were active this month.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#E8BFAE]">
                Avg cost per call
              </div>
              <div className="mt-2 text-3xl font-semibold">
                ₹{data.totalApiCalls === 0 ? '0' : (data.totalCostInr / data.totalApiCalls).toFixed(2)}
              </div>
              <p className="mt-2 text-sm text-[#F8DDD3]/72">
                Based on {data.totalApiCalls.toLocaleString('en-IN')} successful AI calls this month.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
