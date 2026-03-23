interface SEOMetric {
  label: string
  value: string | number
  change?: string
  positive?: boolean
}

export function OverviewCards({ metrics }: { metrics: SEOMetric[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map(m => (
        <div key={m.label} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4">
          <p className="text-xs text-[#555] mb-1">{m.label}</p>
          <p className="text-2xl font-bold text-white">{m.value}</p>
          {m.change && (
            <p className={`text-xs mt-1 ${m.positive ? 'text-green-400' : 'text-red-400'}`}>
              {m.positive ? '↑' : '↓'} {m.change}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
