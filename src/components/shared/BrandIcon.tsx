import Image from 'next/image'

const BRAND_ASSETS: Record<string, string> = {
  meta: '/brands/meta.png',
  facebook: '/brands/facebook.png',
  instagram: '/brands/instagram.png',
  messenger: '/brands/messenger.png',
  google: '/brands/google.png',
  adwords: '/brands/adwords.png',
  linkedin: '/brands/linkedin.png',
  stripe: '/brands/stripe.png',
  hubspot: '/brands/hubspot.png',
  social: '/brands/social.png',
}

const FALLBACK_LABELS: Record<string, string> = {
  meta: 'M',
  facebook: 'f',
  instagram: 'ig',
  messenger: 'ms',
  google: 'G',
  adwords: 'GA',
  linkedin: 'in',
  stripe: 'S',
  hubspot: 'H',
  shopify: 'S',
  social: 'S',
}

export function BrandIcon({
  brand,
  alt,
  size = 20,
  className = '',
  rounded = true,
  background,
}: {
  brand: string
  alt?: string
  size?: number
  className?: string
  rounded?: boolean
  background?: string
}) {
  const src = BRAND_ASSETS[brand]
  const fallback = FALLBACK_LABELS[brand] ?? brand.slice(0, 2).toUpperCase()

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center font-semibold text-white ${rounded ? 'rounded-md' : ''} ${className}`}
        style={{ width: size, height: size, background: background ?? '#1E1E1E', fontSize: Math.max(10, Math.floor(size * 0.42)) }}
      >
        {fallback}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden ${rounded ? 'rounded-md' : ''} ${className}`}
      style={{ width: size, height: size, background: background ?? 'transparent' }}
    >
      <Image
        src={src}
        alt={alt ?? `${brand} logo`}
        width={size}
        height={size}
        className="object-contain"
      />
    </span>
  )
}
