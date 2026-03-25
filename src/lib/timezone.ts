/** Returns the current hour (0–23) in the given IANA timezone. Falls back to UTC hour. */
export function getCurrentHour(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date())
    const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
    return isNaN(h) ? new Date().getUTCHours() : h
  } catch {
    return new Date().getUTCHours()
  }
}

/** Returns the current minute (0–59) in the given IANA timezone. Falls back to UTC minute. */
export function getCurrentMinute(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      minute: 'numeric',
    }).formatToParts(new Date())
    const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
    return isNaN(m) ? new Date().getUTCMinutes() : m
  } catch {
    return new Date().getUTCMinutes()
  }
}

/** Returns the current weekday (0=Sun … 6=Sat) in the given IANA timezone. Falls back to UTC. */
export function getCurrentDay(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).formatToParts(new Date())
    const day = parts.find(p => p.type === 'weekday')?.value
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day ?? '') ?? new Date().getUTCDay()
  } catch {
    return new Date().getUTCDay()
  }
}

/** Returns "YYYY-MM-DD" in the given IANA timezone. */
export function getLocalDate(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value ?? ''
    const m = parts.find(p => p.type === 'month')?.value ?? ''
    const d = parts.find(p => p.type === 'day')?.value ?? ''
    return `${y}-${m}-${d}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Returns "YYYY-Wnn" ISO week string for the current date in the given timezone. */
export function getISOWeek(timezone: string): string {
  try {
    const localDate = getLocalDate(timezone)
    const d = new Date(localDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
    const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7)
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}
