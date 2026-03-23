export function ToolCallIndicator({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 ml-10">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-full">
        <svg className="animate-spin w-3 h-3 text-[#DA7756]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-[#A0A0A0]">{tool}</span>
      </div>
    </div>
  )
}
