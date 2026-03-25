// ── IANA timezone list with GMT offset labels ─────────────────────────────────
// Used by the settings UI (dropdown) and API validation.

const FALLBACK_ZONES = [
  'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
  'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/New_York',
  'America/Halifax', 'America/St_Johns', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'Atlantic/Azores', 'UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Helsinki', 'Europe/Istanbul', 'Asia/Dubai', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney', 'Australia/Adelaide',
  'Pacific/Auckland', 'Pacific/Fiji',
]

/** Returns every valid IANA timezone string the runtime knows about. */
export function getSupportedTimezones(): string[] {
  try {
    // Available in Node 18+ and modern browsers
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] })
      .supportedValuesOf('timeZone')
  } catch {
    return FALLBACK_ZONES
  }
}

/** Returns "GMT+5:30" style offset string for a given IANA timezone. */
export function getGMTOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0'
  } catch {
    return 'GMT+0'
  }
}

/** Parses "GMT+5:30" → numeric minutes (for sorting). */
function offsetToMinutes(offsetStr: string): number {
  const m = offsetStr.match(/GMT([+-])(\d+):?(\d*)/)
  if (!m) return 0
  const sign = m[1] === '+' ? 1 : -1
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10))
}

export type TimezoneOption = {
  value: string   // IANA string stored in DB
  label: string   // "Asia/Kolkata (GMT+5:30)"
  offset: number  // minutes from UTC, for sorting
}

/** Builds the full sorted dropdown list. Call once per page load. */
export function buildTimezoneOptions(): TimezoneOption[] {
  const zones = getSupportedTimezones()
  const now = new Date()

  const options: TimezoneOption[] = []
  for (const tz of zones) {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
      }).formatToParts(now)
      const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0'
      options.push({
        value: tz,
        label: `${tz.replace(/_/g, ' ')} (${offsetStr})`,
        offset: offsetToMinutes(offsetStr),
      })
    } catch {
      // skip invalid entries
    }
  }

  // Sort by UTC offset, then alphabetically within the same offset
  return options.sort((a, b) => a.offset - b.offset || a.value.localeCompare(b.value))
}

/** Returns true if the timezone string is a valid IANA timezone. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz }).format()
    // Also cross-check against the supported list when available
    const supported = getSupportedTimezones()
    return supported.includes(tz)
  } catch {
    return false
  }
}
