'use client'

type CalendarPost = {
  _id: string
  title: string
  scheduledAt?: string
  [key: string]: unknown
}

export function BlogCalendar<T extends CalendarPost>({
  posts, onPostClick, month, year, onPrevMonth, onNextMonth,
}: {
  posts: T[]
  onPostClick: (post: T) => void
  month: number
  year: number
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const today = new Date()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  const scheduled = posts.filter(p => p.scheduledAt)
  const getPostsForDay = (day: number) =>
    scheduled.filter(p => {
      const d = new Date(p.scheduledAt!)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3">
        <button
          onClick={onPrevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] min-w-[140px] text-center">{monthName}</h3>
        <button
          onClick={onNextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {days.map(d => (
          <div key={d} className="py-2 text-center text-xs text-[var(--text-secondary)] font-medium">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e${i}`} className="h-20 border-r border-b border-[var(--border)]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const dayPosts = getPostsForDay(day)
          return (
            <div key={day} className="h-20 border-r border-b border-[var(--border)] p-1.5 overflow-hidden">
              <span className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                isToday ? 'bg-[#DA7756] text-white' : 'text-[var(--text-primary)]'
              }`}>
                {day}
              </span>
              <div className="space-y-0.5 mt-0.5">
                {dayPosts.slice(0, 2).map(p => (
                  <div
                    key={p._id}
                    onClick={() => onPostClick(p)}
                    className="text-[9px] bg-[#DA7756]/20 text-[#DA7756] rounded px-1 py-0.5 truncate cursor-pointer hover:bg-[#DA7756]/30"
                  >
                    {p.title}
                  </div>
                ))}
                {dayPosts.length > 2 && (
                  <div className="text-[9px] text-[var(--text-muted)]">+{dayPosts.length - 2}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
