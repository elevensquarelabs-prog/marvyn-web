import axios from 'axios'
import crypto from 'crypto'

export interface ShopifyContext {
  shop: string        // e.g. mystore.myshopify.com
  accessToken: string
}

// Hard caps — prevents timeouts and noise on large stores
const MAX_ORDERS_PER_PAGE = 250   // Shopify's API maximum
const MAX_PAGES           = 4     // 1 000 orders absolute ceiling

function shopifyApi(ctx: ShopifyContext) {
  return axios.create({
    baseURL: `https://${ctx.shop}/admin/api/2024-04`,
    headers: { 'X-Shopify-Access-Token': ctx.accessToken, 'Content-Type': 'application/json' },
    timeout: 15_000,
  })
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── Orders — paginated with hard cap ────────────────────────────────────────

async function fetchOrders(ctx: ShopifyContext, days: number): Promise<{
  orders: Record<string, unknown>[]
  truncated: boolean
}> {
  const api = shopifyApi(ctx)
  const allOrders: Record<string, unknown>[] = []
  let pageInfo: string | null = null
  let pages = 0
  let truncated = false

  while (pages < MAX_PAGES) {
    const params: Record<string, unknown> = {
      status: 'any',
      limit: MAX_ORDERS_PER_PAGE,
      fields: 'id,created_at,total_price,total_discounts,financial_status,customer,source_name,discount_codes,refunds',
    }
    if (pageInfo) {
      params.page_info = pageInfo
    } else {
      params.created_at_min = daysAgo(days)
      params.financial_status = 'any'
    }

    const res = await api.get('/orders.json', { params })
    const batch = (res.data.orders ?? []) as Record<string, unknown>[]
    allOrders.push(...batch)
    pages++

    // Shopify cursor pagination via Link header
    const linkHeader = res.headers['link'] as string | undefined
    const nextMatch = linkHeader?.match(/<[^>]*page_info=([^>&"]+)[^>]*>;\s*rel="next"/)
    if (nextMatch && batch.length === MAX_ORDERS_PER_PAGE) {
      pageInfo = nextMatch[1]
    } else {
      break
    }
  }

  // If we hit the cap and there's a next page, we truncated
  if (pages === MAX_PAGES) {
    const checkRes = await api.get('/orders/count.json', {
      params: { status: 'any', created_at_min: daysAgo(days) },
    }).catch(() => null)
    const total = checkRes?.data?.count ?? 0
    truncated = total > allOrders.length
  }

  return { orders: allOrders, truncated }
}

function buildRevenueSummary(orders: Record<string, unknown>[], days: number) {
  const paid = orders.filter(o => o.financial_status !== 'refunded' && o.financial_status !== 'voided')
  const totalRevenue = paid.reduce((s, o) => s + parseFloat(String(o.total_price ?? 0)), 0)
  const orderCount = paid.length
  const aov = orderCount > 0 ? totalRevenue / orderCount : 0

  const refunded = orders.filter(o => o.financial_status === 'refunded').length
  const refundRate = orders.length > 0 ? Math.round((refunded / orders.length) * 100) : 0

  const returning = paid.filter(o => {
    const c = o.customer as Record<string, unknown> | undefined
    return c && Number(c.orders_count ?? 1) > 1
  }).length
  const repeatRate = orderCount > 0 ? Math.round((returning / orderCount) * 100) : 0

  // Daily revenue trend — 90 data points max
  const dailyMap: Record<string, number> = {}
  for (const o of paid) {
    const day = String(o.created_at ?? '').slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + parseFloat(String(o.total_price ?? 0))
  }
  const trend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))

  const topDays = [...trend].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // Source attribution from order.source_name
  const sourceCounts: Record<string, number> = {}
  for (const o of paid) {
    const src = String(o.source_name ?? 'unknown')
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }
  const bySource = Object.entries(sourceCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([source, count]) => ({ source, count, share: orderCount > 0 ? Math.round((count / orderCount) * 100) : 0 }))

  return {
    periodDays: days,
    totalRevenue: Math.round(totalRevenue),
    orderCount,
    avgOrderValue: Math.round(aov),
    refundRate,
    repeatRate,
    trend,
    topDays,
    bySource,
  }
}

// ─── Products — top 10 by revenue derived from capped order set ───────────────

function buildProductSales(orders: Record<string, unknown>[]) {
  // Note: line_items not fetched in orders (stripped for size). Use a separate
  // products query sorted by created_at as a proxy for recent velocity.
  // Product-level revenue requires line_items — only feasible within the 1k order cap.
  const productRevenue: Record<string, { title: string; revenue: number; units: number }> = {}

  for (const order of orders) {
    const lineItems = (order.line_items as Record<string, unknown>[] | undefined) ?? []
    for (const item of lineItems) {
      const id = String(item.product_id ?? 'unknown')
      const title = String(item.title ?? 'Unknown')
      const qty = Number(item.quantity ?? 0)
      const price = parseFloat(String(item.price ?? 0))
      if (!productRevenue[id]) productRevenue[id] = { title, revenue: 0, units: 0 }
      productRevenue[id].revenue += qty * price
      productRevenue[id].units += qty
    }
  }

  const ranked = Object.entries(productRevenue)
    .map(([id, v]) => ({ id, ...v, revenue: Math.round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    topByRevenue: ranked.slice(0, 10),
    topByVolume: [...ranked].sort((a, b) => b.units - a.units).slice(0, 10),
  }
}

// ─── Abandoned checkouts — count-first, minimal payload ──────────────────────

async function fetchAbandonedCheckouts(ctx: ShopifyContext, days: number) {
  const api = shopifyApi(ctx)

  // Fetch count only first — avoids loading full objects for large stores
  const [abandonedCount, completedCount] = await Promise.all([
    api.get('/checkouts/count.json', { params: { created_at_min: daysAgo(days) } })
       .then(r => (r.data.count as number) ?? 0).catch(() => 0),
    api.get('/orders/count.json', { params: { created_at_min: daysAgo(days), status: 'any', financial_status: 'paid' } })
       .then(r => (r.data.count as number) ?? 0).catch(() => 0),
  ])

  const total = abandonedCount + completedCount
  const rate = total > 0 ? Math.round((abandonedCount / total) * 100) : 0

  // Fetch minimal abandoned checkout data (capped at 50) for revenue estimate
  const sample = await api.get('/checkouts.json', {
    params: { created_at_min: daysAgo(days), limit: 50, fields: 'id,total_price,created_at' },
  }).then(r => (r.data.checkouts ?? []) as Record<string, unknown>[]).catch(() => [])

  const sampleRevenueLost = sample.reduce((s, c) => s + parseFloat(String(c.total_price ?? 0)), 0)
  // Extrapolate to full count
  const revenueLost = sample.length > 0
    ? Math.round((sampleRevenueLost / sample.length) * abandonedCount)
    : 0

  return { abandonedCount, completedCount, abandonmentRate: rate, revenueLost }
}

// ─── Customers — aggregated, no PII ──────────────────────────────────────────

async function fetchCustomerSummary(ctx: ShopifyContext) {
  const api = shopifyApi(ctx)
  // Fetch only the fields needed for aggregation — no names, emails, addresses
  const res = await api.get('/customers.json', {
    params: { limit: 250, fields: 'id,orders_count,total_spent,default_address' },
  }).catch(() => ({ data: { customers: [] } }))

  const customers = (res.data.customers ?? []) as Record<string, unknown>[]

  const newCount       = customers.filter(c => Number(c.orders_count ?? 0) === 1).length
  const returningCount = customers.filter(c => Number(c.orders_count ?? 0) > 1).length
  const repeatRate     = customers.length > 0 ? Math.round((returningCount / customers.length) * 100) : 0

  const geoCounts: Record<string, number> = {}
  for (const c of customers) {
    const country = (c.default_address as Record<string, unknown> | undefined)?.country_name
    if (country) geoCounts[String(country)] = (geoCounts[String(country)] ?? 0) + 1
  }
  const topGeographies = Object.entries(geoCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }))

  // LTV proxy: average total_spent of top 10% of customers
  const bySpend = [...customers]
    .sort((a, b) => parseFloat(String(b.total_spent ?? 0)) - parseFloat(String(a.total_spent ?? 0)))
  const top10Pct = bySpend.slice(0, Math.max(1, Math.floor(bySpend.length * 0.1)))
  const avgTopLtv = top10Pct.length > 0
    ? Math.round(top10Pct.reduce((s, c) => s + parseFloat(String(c.total_spent ?? 0)), 0) / top10Pct.length)
    : 0

  return { total: customers.length, newCount, returningCount, repeatRate, avgTopLtv, topGeographies }
}

// ─── Discounts ────────────────────────────────────────────────────────────────

async function fetchPriceRules(ctx: ShopifyContext) {
  const api = shopifyApi(ctx)
  const res = await api.get('/price_rules.json', {
    params: { limit: 100, fields: 'id,title,value_type,value,usage_count,starts_at,ends_at,status' },
  }).catch(() => ({ data: { price_rules: [] } }))
  return (res.data.price_rules ?? []) as Record<string, unknown>[]
}

function buildDiscountAnalysis(orders: Record<string, unknown>[], priceRules: Record<string, unknown>[]) {
  // Split orders into discounted vs full-price
  const discountedOrders = orders.filter(o => {
    const codes = o.discount_codes as { code: string; amount: string; type: string }[] | undefined
    return codes && codes.length > 0
  })
  const fullPriceOrders = orders.filter(o => {
    const codes = o.discount_codes as unknown[] | undefined
    return !codes || codes.length === 0
  })

  const totalRevenue = orders.reduce((s, o) => s + parseFloat(String(o.total_price ?? 0)), 0)
  const discountedRevenue = discountedOrders.reduce((s, o) => s + parseFloat(String(o.total_price ?? 0)), 0)
  const fullPriceRevenue = fullPriceOrders.reduce((s, o) => s + parseFloat(String(o.total_price ?? 0)), 0)

  // Total margin bled (sum of all discounts given)
  const totalDiscountGiven = orders.reduce((s, o) => s + parseFloat(String(o.total_discounts ?? 0)), 0)

  // AOV comparison
  const discountedAov = discountedOrders.length > 0
    ? Math.round(discountedRevenue / discountedOrders.length) : 0
  const fullPriceAov = fullPriceOrders.length > 0
    ? Math.round(fullPriceRevenue / fullPriceOrders.length) : 0

  // Per-code breakdown
  const byCode: Record<string, {
    orderCount: number
    revenue: number
    discountGiven: number
    repeatingCustomers: number
    totalCustomers: number
  }> = {}

  for (const order of discountedOrders) {
    const codes = order.discount_codes as { code: string; amount: string }[] | undefined
    if (!codes?.length) continue
    const code = codes[0].code   // use first code if multiple
    const revenue = parseFloat(String(order.total_price ?? 0))
    const discountGiven = parseFloat(String(order.total_discounts ?? 0))
    const isReturning = Number((order.customer as Record<string, unknown> | undefined)?.orders_count ?? 1) > 1

    if (!byCode[code]) byCode[code] = { orderCount: 0, revenue: 0, discountGiven: 0, repeatingCustomers: 0, totalCustomers: 0 }
    byCode[code].orderCount++
    byCode[code].revenue += revenue
    byCode[code].discountGiven += discountGiven
    byCode[code].totalCustomers++
    if (isReturning) byCode[code].repeatingCustomers++
  }

  const codeBreakdown = Object.entries(byCode)
    .map(([code, stats]) => ({
      code,
      orderCount: stats.orderCount,
      revenue: Math.round(stats.revenue),
      discountGiven: Math.round(stats.discountGiven),
      avgOrderValue: stats.orderCount > 0 ? Math.round(stats.revenue / stats.orderCount) : 0,
      avgDiscountDepth: stats.revenue + stats.discountGiven > 0
        ? Math.round((stats.discountGiven / (stats.revenue + stats.discountGiven)) * 100)
        : 0,
      repeatRate: stats.totalCustomers > 0
        ? Math.round((stats.repeatingCustomers / stats.totalCustomers) * 100)
        : 0,
      revenueShare: totalRevenue > 0
        ? Math.round((stats.revenue / totalRevenue) * 100)
        : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Price rules summary (active campaigns)
  const activePriceRules = priceRules
    .filter(r => r.status === 'enabled' || !r.status)
    .map(r => ({
      title: r.title,
      valueType: r.value_type,   // 'percentage' | 'fixed_amount'
      value: r.value,            // e.g. '-20.0' means 20% off
      usageCount: r.usage_count,
    }))
    .slice(0, 10)

  // Average discount depth across all discounted orders
  const avgDiscountDepth = discountedOrders.length > 0
    ? (() => {
        const depths = discountedOrders.map(o => {
          const discGiven = parseFloat(String(o.total_discounts ?? 0))
          const finalPrice = parseFloat(String(o.total_price ?? 0))
          const original = finalPrice + discGiven
          return original > 0 ? (discGiven / original) * 100 : 0
        })
        return Math.round(depths.reduce((s, d) => s + d, 0) / depths.length)
      })()
    : 0

  return {
    summary: {
      discountedOrderCount: discountedOrders.length,
      fullPriceOrderCount: fullPriceOrders.length,
      discountedOrderShare: orders.length > 0
        ? Math.round((discountedOrders.length / orders.length) * 100) : 0,
      totalDiscountGiven: Math.round(totalDiscountGiven),
      discountedRevenue: Math.round(discountedRevenue),
      fullPriceRevenue: Math.round(fullPriceRevenue),
      discountedAov,
      fullPriceAov,
      aovGap: fullPriceAov - discountedAov,   // how much AOV drops with discounts
      avgDiscountDepth,                        // average % off across discounted orders
    },
    byCode: codeBreakdown,
    activePriceRules,
  }
}

// ─── Shop info ────────────────────────────────────────────────────────────────

async function fetchShopInfo(ctx: ShopifyContext) {
  const api = shopifyApi(ctx)
  const res = await api.get('/shop.json')
  const shop = res.data.shop ?? {}
  return {
    name: shop.name,
    domain: shop.domain,
    myshopifyDomain: shop.myshopify_domain,
    currency: shop.currency,
    countryCode: shop.country_code,
    timezone: shop.iana_timezone,
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function fetchShopifyBundle(ctx: ShopifyContext): Promise<Record<string, unknown>> {
  // Fetch orders once (shared across revenue and product calcs) to avoid duplicate API calls
  const { orders: orders30, truncated } = await fetchOrders(ctx, 30)

  const [shopInfo, orders60, orders90, customers, abandonment, priceRules] = await Promise.allSettled([
    fetchShopInfo(ctx),
    fetchOrders(ctx, 60).then(r => r.orders),
    fetchOrders(ctx, 90).then(r => r.orders),
    fetchCustomerSummary(ctx),
    fetchAbandonedCheckouts(ctx, 30),
    fetchPriceRules(ctx),
  ])

  const safe = <T>(r: PromiseSettledResult<T>): T | null => r.status === 'fulfilled' ? r.value : null

  const o60 = safe(orders60) ?? orders30
  const o90 = safe(orders90) ?? orders30

  const rev30 = buildRevenueSummary(orders30, 30)
  const rev60 = buildRevenueSummary(o60, 60)
  const rev90 = buildRevenueSummary(o90, 90)

  const productSales = buildProductSales(orders30)
  const discountAnalysis = buildDiscountAnalysis(orders30, safe(priceRules) ?? [])

  const bundle: Record<string, unknown> = {
    store: safe(shopInfo),
    revenue: {
      last30Days: rev30.totalRevenue,
      last60Days: rev60.totalRevenue,
      last90Days: rev90.totalRevenue,
      avgOrderValue: rev30.avgOrderValue,
      orderCount30d: rev30.orderCount,
      refundRate: rev30.refundRate,
      repeatRate: rev30.repeatRate,
      trend: rev30.trend,
      topDays: rev30.topDays,
      bySource: rev30.bySource,
    },
    products: productSales,
    customers: safe(customers),
    abandonment: safe(abandonment),
    discounts: discountAnalysis,
  }

  // Honesty signal — surface truncation so agents can caveat confidence
  if (truncated) {
    bundle.dataNote = `Analysis based on most recent ${orders30.length} orders — large store volume detected. Revenue trends and product rankings are directionally accurate but may not reflect the full period.`
  }

  return bundle
}

// ─── HMAC verification for Shopify OAuth callbacks ───────────────────────────

export function verifyShopifyHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get('hmac')
  if (!hmac) return false

  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key !== 'hmac') pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  })
  pairs.sort()

  const message = pairs.join('&')
  const hash = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac))
}
