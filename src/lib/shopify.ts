import axios from 'axios'

export interface ShopifyContext {
  shop: string        // e.g. mystore.myshopify.com
  accessToken: string
}

function shopifyApi(ctx: ShopifyContext) {
  return axios.create({
    baseURL: `https://${ctx.shop}/admin/api/2024-04`,
    headers: { 'X-Shopify-Access-Token': ctx.accessToken, 'Content-Type': 'application/json' },
  })
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

async function fetchOrders(ctx: ShopifyContext, days: number) {
  const api = shopifyApi(ctx)
  const res = await api.get('/orders.json', {
    params: {
      status: 'any',
      created_at_min: daysAgo(days),
      limit: 250,
      fields: 'id,created_at,total_price,financial_status,customer,source_name,landing_site,referring_site,refunds,line_items',
    },
  })
  return (res.data.orders ?? []) as Record<string, unknown>[]
}

function buildRevenueSummary(orders: Record<string, unknown>[], days: number) {
  const paid = orders.filter(o => o.financial_status !== 'refunded' && o.financial_status !== 'voided')
  const totalRevenue = paid.reduce((s, o) => s + parseFloat(String(o.total_price ?? 0)), 0)
  const orderCount = paid.length
  const aov = orderCount > 0 ? totalRevenue / orderCount : 0

  const refunded = orders.filter(o => o.financial_status === 'refunded').length
  const refundRate = orders.length > 0 ? Math.round((refunded / orders.length) * 100) : 0

  // Returning vs first-time
  const customerIds = paid.map(o => (o.customer as Record<string, unknown>)?.id).filter(Boolean)
  const uniqueCustomers = new Set(customerIds)
  // If customer has orders_count > 1 they're returning (Shopify sets this on customer object)
  const returning = paid.filter(o => {
    const c = o.customer as Record<string, unknown> | undefined
    return c && Number(c.orders_count ?? 1) > 1
  }).length
  const repeatRate = orderCount > 0 ? Math.round((returning / orderCount) * 100) : 0

  // Daily revenue trend
  const dailyMap: Record<string, number> = {}
  for (const o of paid) {
    const day = String(o.created_at ?? '').slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + parseFloat(String(o.total_price ?? 0))
  }
  const trend = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))

  // Top revenue days (seasonality signal)
  const topDays = [...trend].sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // UTM / source attribution
  const sourceCounts: Record<string, number> = {}
  for (const o of paid) {
    const src = String(o.source_name ?? 'unknown')
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }
  const bySource = Object.entries(sourceCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([source, count]) => ({ source, count, share: Math.round((count / orderCount) * 100) }))

  return {
    periodDays: days,
    totalRevenue: Math.round(totalRevenue),
    orderCount,
    avgOrderValue: Math.round(aov),
    refundRate,
    repeatRate,
    uniqueCustomers: uniqueCustomers.size,
    trend,
    topDays,
    bySource,
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function fetchProducts(ctx: ShopifyContext) {
  const api = shopifyApi(ctx)
  const res = await api.get('/products.json', {
    params: { limit: 250, fields: 'id,title,status,variants,image' },
  })
  return (res.data.products ?? []) as Record<string, unknown>[]
}

async function fetchProductSales(ctx: ShopifyContext, days: number) {
  const orders = await fetchOrders(ctx, days)
  const productRevenue: Record<string, { title: string; revenue: number; units: number }> = {}

  for (const order of orders) {
    const lineItems = (order.line_items as Record<string, unknown>[]) ?? []
    for (const item of lineItems) {
      const id = String(item.product_id ?? '')
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

// ─── Abandoned Checkouts ──────────────────────────────────────────────────────

async function fetchAbandonedCheckouts(ctx: ShopifyContext, days: number) {
  const api = shopifyApi(ctx)
  const res = await api.get('/checkouts.json', {
    params: { created_at_min: daysAgo(days), limit: 250, fields: 'id,created_at,total_price,completed_at' },
  }).catch(() => ({ data: { checkouts: [] } }))

  const checkouts = (res.data.checkouts ?? []) as Record<string, unknown>[]
  const abandoned = checkouts.filter(c => !c.completed_at)
  const completed = checkouts.filter(c => c.completed_at)

  const rate = checkouts.length > 0 ? Math.round((abandoned.length / checkouts.length) * 100) : 0
  const revenueLost = abandoned.reduce((s, c) => s + parseFloat(String(c.total_price ?? 0)), 0)

  const dailyAbandoned: Record<string, number> = {}
  for (const c of abandoned) {
    const day = String(c.created_at ?? '').slice(0, 10)
    dailyAbandoned[day] = (dailyAbandoned[day] ?? 0) + 1
  }
  const trend = Object.entries(dailyAbandoned)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  return {
    totalCheckouts: checkouts.length,
    abandonedCount: abandoned.length,
    completedCount: completed.length,
    abandonmentRate: rate,
    revenueLost: Math.round(revenueLost),
    trend,
  }
}

// ─── Customers ────────────────────────────────────────────────────────────────

async function fetchCustomerSummary(ctx: ShopifyContext) {
  const api = shopifyApi(ctx)
  const res = await api.get('/customers.json', {
    params: { limit: 250, fields: 'id,orders_count,total_spent,default_address,created_at' },
  })
  const customers = (res.data.customers ?? []) as Record<string, unknown>[]

  const newCustomers = customers.filter(c => Number(c.orders_count ?? 0) === 1).length
  const returning = customers.filter(c => Number(c.orders_count ?? 0) > 1).length

  // Top LTV customers
  const byLtv = [...customers]
    .sort((a, b) => parseFloat(String(b.total_spent ?? 0)) - parseFloat(String(a.total_spent ?? 0)))
    .slice(0, 5)
    .map(c => ({
      ordersCount: c.orders_count,
      totalSpent: Math.round(parseFloat(String(c.total_spent ?? 0))),
    }))

  // Geographic distribution
  const geoCounts: Record<string, number> = {}
  for (const c of customers) {
    const country = (c.default_address as Record<string, unknown> | undefined)?.country_name
    if (country) geoCounts[String(country)] = (geoCounts[String(country)] ?? 0) + 1
  }
  const topGeographies = Object.entries(geoCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }))

  return {
    total: customers.length,
    newCustomers,
    returningCustomers: returning,
    repeatRate: customers.length > 0 ? Math.round((returning / customers.length) * 100) : 0,
    topLtvSegment: byLtv,
    topGeographies,
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
  const [shopInfo, productSales, customers, abandonment, revenue30, revenue60, revenue90] = await Promise.allSettled([
    fetchShopInfo(ctx),
    fetchProductSales(ctx, 30),
    fetchCustomerSummary(ctx),
    fetchAbandonedCheckouts(ctx, 30),
    fetchOrders(ctx, 30).then(o => buildRevenueSummary(o, 30)),
    fetchOrders(ctx, 60).then(o => buildRevenueSummary(o, 60)),
    fetchOrders(ctx, 90).then(o => buildRevenueSummary(o, 90)),
  ])

  const safe = <T>(r: PromiseSettledResult<T>): T | null => r.status === 'fulfilled' ? r.value : null

  const rev30 = safe(revenue30)
  const rev60 = safe(revenue60)
  const rev90 = safe(revenue90)

  return {
    store: safe(shopInfo),
    revenue: {
      last30Days: rev30?.totalRevenue,
      last60Days: rev60?.totalRevenue,
      last90Days: rev90?.totalRevenue,
      avgOrderValue: rev30?.avgOrderValue,
      orderCount30d: rev30?.orderCount,
      refundRate: rev30?.refundRate,
      repeatRate: rev30?.repeatRate,
      trend: rev30?.trend,
      topDays: rev30?.topDays,
      bySource: rev30?.bySource,
    },
    products: safe(productSales),
    customers: safe(customers),
    abandonment: safe(abandonment),
  }
}

// ─── HMAC verification for Shopify OAuth callbacks ───────────────────────────

import crypto from 'crypto'

export function verifyShopifyHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get('hmac')
  if (!hmac) return false

  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key !== 'hmac') pairs.push(`${key}=${value}`)
  })
  pairs.sort()

  const message = pairs.join('&')
  const hash = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac))
}
