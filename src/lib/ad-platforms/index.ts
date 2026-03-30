export interface AdPlatformDef {
  key: string
  label: string
  color: string
  icon: string
}

// ── Registry ──────────────────────────────────────────────────────────────────
// To add a new ad platform: add one entry here.
// All UI (filters, charts, breakdowns) and the agent tool description
// auto-derive from this list — no other file needs to be touched for metadata.

export const AD_PLATFORM_REGISTRY: Record<string, AdPlatformDef> = {
  meta:     { key: 'meta',     label: 'Meta Ads',     color: '#1877F2', icon: 'M'  },
  google:   { key: 'google',   label: 'Google Ads',   color: '#34A853', icon: 'G'  },
  linkedin: { key: 'linkedin', label: 'LinkedIn Ads', color: '#0A66C2', icon: 'in' },
}

export const AD_PLATFORM_KEYS = Object.keys(AD_PLATFORM_REGISTRY)
