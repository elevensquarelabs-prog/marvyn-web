import StatCard from '@/components/admin/StatCard'

type CostData = {
  summary: {
    totalBetaUsers: number
    activeThisMonth: number
    totalEstimatedCostUsdThisMonth: number
    totalEstimatedCostInrThisMonth: number
    totalCreditsUsedThisMonth: number
  }
  featureTotals: Array<{ feature: string; calls: number; creditsCharged: number; estimatedCostUsd: number; estimatedCostInr: number }>
  modelTotals: Array<{ model: string; label: string; calls: number; creditsCharged: number; estimatedCostUsd: number; estimatedCostInr: number }>
  providerTotals: Array<{ provider: string; calls: number; creditsCharged: number; estimatedCostUsd: number; estimatedCostInr: number }>
}

function humanize(value: string) {
  return value.replace(/_/g, ' ')
}

function SectionTable({
  title,
  rows,
  labelKey,
  labelTitle,
  showCredits,
}: {
  title: string
  rows: Array<Record<string, string | number>>
  labelKey: string
  labelTitle: string
  showCredits?: boolean
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[#E6D8CF] bg-white/88 shadow-[0_20px_60px_rgba(73,40,28,0.08)]">
      <div className="border-b border-[#EEE2DA] bg-[#FCF8F4] px-6 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6E544A]">
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-[#F1E7E0]">
            <tr>
              <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7A6E]">
                {labelTitle}
              </th>
              <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7A6E]">
                Calls
              </th>
              {showCredits ? (
                <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7A6E]">
                  Credits
                </th>
              ) : null}
              <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9C7A6E]">
                Cost (₹)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1E7E0]">
            {rows.map(row => (
              <tr key={String(row[labelKey])} className="transition hover:bg-[#FFF9F5]">
                <td className="px-6 py-4 text-sm font-semibold text-[#2B1C17]">
                  {humanize(String(row[labelKey]))}
                </td>
                <td className="px-6 py-4 text-right text-sm text-[#6F564C]">
                  {Number(row.calls).toLocaleString('en-IN')}
                </td>
                {showCredits ? (
                  <td className="px-6 py-4 text-right text-sm text-[#6F564C]">
                    {Number(row.creditsCharged).toLocaleString('en-IN')}
                  </td>
                ) : null}
                <td className="px-6 py-4 text-right text-sm font-semibold text-[#2B1C17]">
                  ₹{Number(row.estimatedCostInr).toFixed(2)}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={showCredits ? 4 : 3}
                  className="px-6 py-10 text-center text-sm text-[#8D7166]"
                >
                  No usage recorded for this section yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function AdminCostsShell({
  currentMonth,
  data,
}: {
  currentMonth: string
  data: CostData
}) {
  const { summary } = data

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
      <div className="mb-10 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#9C7A6E]">
          Admin costs
        </p>
        <div className="space-y-2">
          <h1 className="font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-[-0.04em] text-[#221814] sm:text-5xl">
            Cost Analytics
          </h1>
          <p className="text-sm leading-6 text-[#7C6258]">
            Current billing month: {currentMonth}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total AI Cost"
          value={`₹${summary.totalEstimatedCostInrThisMonth.toFixed(0)}`}
          sub={`$${summary.totalEstimatedCostUsdThisMonth.toFixed(4)} USD`}
          accent
        />
        <StatCard
          label="Credits Used"
          value={summary.totalCreditsUsedThisMonth.toLocaleString('en-IN')}
          sub="Across all tracked features"
        />
        <StatCard
          label="Active Users"
          value={summary.activeThisMonth.toLocaleString('en-IN')}
          sub={`of ${summary.totalBetaUsers.toLocaleString('en-IN')} total`}
        />
      </div>

      <div className="mt-8 space-y-6">
        <SectionTable
          title="Cost by Feature"
          rows={[...data.featureTotals].sort((a, b) => b.estimatedCostInr - a.estimatedCostInr)}
          labelKey="feature"
          labelTitle="Feature"
          showCredits
        />

        <SectionTable
          title="Cost by Model"
          rows={[...data.modelTotals]
            .filter(row => row.calls > 0)
            .sort((a, b) => b.estimatedCostInr - a.estimatedCostInr)}
          labelKey="label"
          labelTitle="Model"
        />

        <SectionTable
          title="Cost by Provider"
          rows={[...data.providerTotals]
            .filter(row => row.calls > 0)
            .sort((a, b) => b.estimatedCostInr - a.estimatedCostInr)}
          labelKey="provider"
          labelTitle="Provider"
          showCredits
        />
      </div>
    </div>
  )
}
