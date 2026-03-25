import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { llm } from '@/lib/llm'
import { buildLimitResponse, enforceAiBudget, estimateCostInr, getModelNameFromComplexity, recordAiUsage } from '@/lib/ai-usage'
import { MAX_COMPETITORS, getCompetitorDomain, getCompetitorUrl, normalizeAuditCompetitors, normalizeBrandCompetitors, removeAuditCompetitor, removeBrandCompetitor, upsertAuditCompetitor, upsertBrandCompetitor } from '@/lib/competitors'
import Brand from '@/models/Brand'
import SEOAudit from '@/models/SEOAudit'
import { getCompetitorData, getDfsCredentials } from '@/lib/dataforseo'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { url, analyze } = await req.json()

  const brand = await Brand.findOne({ userId: session.user.id })
  if (!brand) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const cleanDomain = getCompetitorDomain(url || '')
  if (!cleanDomain) return Response.json({ error: 'Valid competitor URL required' }, { status: 400 })

  const currentBrandCompetitors = normalizeBrandCompetitors(brand.competitors || [])
  const alreadyExists = currentBrandCompetitors.some(item => getCompetitorDomain(item.url) === cleanDomain)
  if (!alreadyExists && currentBrandCompetitors.length >= MAX_COMPETITORS) {
    return Response.json({ error: `Competitor limit reached (max ${MAX_COMPETITORS})`, competitors: currentBrandCompetitors }, { status: 400 })
  }

  const competitor = { url: getCompetitorUrl(cleanDomain), name: cleanDomain, status: 'pending', analyzedAt: new Date() }

  if (analyze) {
    const budget = await enforceAiBudget(session.user.id, 'competitor_tagging')
    if (!budget.allowed) {
      return Response.json(buildLimitResponse(budget), { status: 429 })
    }
    try {
      const prompt = `Analyze this competitor website: ${competitor.url}

Based on the URL and domain, provide a competitive analysis in JSON:
{
  "name": "Company Name",
  "positioning": "Their main value proposition and market position",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "status": "analyzed"
}
Only return valid JSON.`

      const raw = await llm(prompt, 'You are a competitive intelligence analyst.', 'medium')
      const usage = estimateCostInr({
        model: getModelNameFromComplexity('medium'),
        inputText: `You are a competitive intelligence analyst.\n${prompt}`,
        outputText: raw,
      })
      await recordAiUsage({
        userId: session.user.id,
        feature: 'competitor_tagging',
        model: getModelNameFromComplexity('medium'),
        estimatedInputTokens: usage.inputTokens,
        estimatedOutputTokens: usage.outputTokens,
        estimatedCostInr: usage.estimatedCostInr,
      })
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        Object.assign(competitor, data)
      }
    } catch (e) {
      console.error('[competitors]', e)
      await recordAiUsage({
        userId: session.user.id,
        feature: 'competitor_tagging',
        model: getModelNameFromComplexity('medium'),
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCostInr: 0,
        status: 'failed',
      })
    }
  }

  const nextBrandCompetitors = upsertBrandCompetitor(currentBrandCompetitors, competitor)
  brand.competitors = nextBrandCompetitors
  await brand.save()

  const audit = await SEOAudit.findOne({ userId: session.user.id })
  if (audit) {
    let nextAuditCompetitors = normalizeAuditCompetitors(audit.competitors || [])
    if (!nextAuditCompetitors.some(item => getCompetitorDomain(item.domain) === cleanDomain)) {
      const credentials = getDfsCredentials()
      let metrics: { organicTraffic?: number; organicKeywords?: number } = {}
      if (credentials) {
        try {
          metrics = await getCompetitorData(cleanDomain, '', credentials)
        } catch {}
      }
      nextAuditCompetitors = upsertAuditCompetitor(nextAuditCompetitors, {
        domain: cleanDomain,
        url: getCompetitorUrl(cleanDomain),
        tag: 'unset',
        added: true,
        title: competitor.name,
        organicTraffic: metrics.organicTraffic,
        organicKeywords: metrics.organicKeywords,
      })
      audit.competitors = nextAuditCompetitors
      await audit.save()
    }
  }

  return Response.json({ competitor, competitors: nextBrandCompetitors }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { url } = await req.json()
  const cleanDomain = getCompetitorDomain(url || '')
  const brand = await Brand.findOne({ userId: session.user.id })
  if (brand) {
    brand.competitors = removeBrandCompetitor(brand.competitors || [], cleanDomain)
    await brand.save()
  }
  const audit = await SEOAudit.findOne({ userId: session.user.id })
  if (audit) {
    audit.competitors = removeAuditCompetitor(audit.competitors || [], cleanDomain)
    await audit.save()
  }
  return Response.json({ success: true, competitors: brand?.competitors || [] })
}
