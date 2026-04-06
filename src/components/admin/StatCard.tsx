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
    <div
      className={`rounded-[1.5rem] border p-5 shadow-[0_12px_36px_rgba(64,34,24,0.06)] ${
        accent
          ? 'border-[#D9A38A] bg-[linear-gradient(135deg,#9B482A_0%,#D97757_100%)] text-white'
          : 'border-[#E6D7CE] bg-white/85 text-[#221814]'
      }`}
    >
      <div className={`mb-2 text-[11px] font-medium uppercase tracking-[0.22em] ${accent ? 'text-white/70' : 'text-[#9A7C70]'}`}>
        {label}
      </div>
      <div className={`text-3xl font-semibold tracking-[-0.03em] ${accent ? 'text-white' : 'text-[#221814]'}`}>
        {value}
      </div>
      {sub && (
        <div className={`mt-2 text-sm ${accent ? 'text-white/78' : 'text-[#7D6156]'}`}>
          {sub}
        </div>
      )}
    </div>
  )
}
