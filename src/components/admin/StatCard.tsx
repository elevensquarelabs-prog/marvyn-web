export default function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-violet-600/10 border-violet-600/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent ? 'text-violet-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  )
}
