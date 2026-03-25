'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/shared/Button'

const COPY_TYPES = [
  { id: 'seo-brief', label: 'SEO Brief', icon: '🎯', description: 'Keyword, intent, outline, title, meta, CTA' },
  { id: 'landing', label: 'Landing Page', icon: '🏠', description: 'Full page with headline, sub, benefits, CTA' },
  { id: 'ad', label: 'Ad Copy', icon: '📣', description: 'Headlines + descriptions for Google/Meta Ads' },
  { id: 'product', label: 'Product Description', icon: '🛍️', description: 'Benefit-focused product copy' },
  { id: 'headline', label: 'Headlines', icon: '✨', description: '10 headline variations for A/B testing' },
  { id: 'cta', label: 'CTAs', icon: '🎯', description: 'Call-to-action button copy variations' },
  { id: 'value-prop', label: 'Value Proposition', icon: '💎', description: 'Tagline + 3 core value statements' },
]

const FRAMEWORKS = [
  { id: 'aida', label: 'AIDA', description: 'Attention → Interest → Desire → Action' },
  { id: 'pas', label: 'PAS', description: 'Problem → Agitate → Solution' },
  { id: 'fab', label: 'FAB', description: 'Features → Advantages → Benefits' },
  { id: 'storybrand', label: 'StoryBrand', description: 'Customer as hero, brand as guide' },
]

interface SavedAsset {
  _id: string
  name: string
  copyType: string
  product: string
  content: string
  createdAt: string
}

interface GeneratedDocument {
  title?: string
  summary?: string
  sections?: Array<{ heading: string; points: string[] }>
}

export default function CopyPage() {
  const searchParams = useSearchParams()
  const [copyType, setCopyType] = useState('landing')
  const [framework, setFramework] = useState('aida')
  const [product, setProduct] = useState('')
  const [pageType, setPageType] = useState('landing-page')
  const [searchIntent, setSearchIntent] = useState('commercial')
  const [recommendedWordCount, setRecommendedWordCount] = useState('900-1400')
  const [audience, setAudience] = useState('')
  const [usp, setUsp] = useState('')
  const [tone, setTone] = useState('professional')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [agentStatus, setAgentStatus] = useState('')
  const [output, setOutput] = useState('')
  const [document, setDocument] = useState<GeneratedDocument | null>(null)
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([])
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'generate' | 'saved'>('generate')
  const [pendingPrefillKey, setPendingPrefillKey] = useState('')

  const loadSaved = useCallback(async () => {
    const res = await fetch('/api/copy')
    if (res.ok) {
      const data = await res.json()
      setSavedAssets(data.assets || [])
    }
  }, [])

  useEffect(() => { loadSaved() }, [loadSaved])

  useEffect(() => {
    const topic = searchParams.get('topic')
    const type = searchParams.get('type')
    const intent = searchParams.get('intent')
    const pageTypeParam = searchParams.get('pageType')
    const wordCount = searchParams.get('wordCount')
    if (type && COPY_TYPES.some(item => item.id === type)) setCopyType(type)
    if (topic) setProduct(prev => prev || topic)
    if (intent) setSearchIntent(intent)
    if (pageTypeParam) setPageType(pageTypeParam)
    if (wordCount) setRecommendedWordCount(wordCount)
  }, [searchParams])

  const saveGeneratedAsset = useCallback(async (content: string) => {
    const assetLabel = COPY_TYPES.find(t => t.id === copyType)?.label || copyType
    const name = `${assetLabel} — ${product.slice(0, 30)}`
    await fetch('/api/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, copyType, framework, product, audience, content }),
    })
    await loadSaved()
  }, [audience, copyType, framework, loadSaved, product])

  const generate = useCallback(async () => {
    if (!product) return
    setGenerating(true)
    setGenerateError('')
    setAgentStatus('Preparing structured brief…')
    setOutput('')
    setDocument(null)

    const statusFrames = [
      'Analyzing input…',
      'Selecting the right model…',
      'Generating structured sections…',
      'Finalizing output…',
    ]
    let frame = 0
    const statusTimer = setInterval(() => {
      frame = (frame + 1) % statusFrames.length
      setAgentStatus(statusFrames[frame])
    }, 900)

    try {
      const res = await fetch('/api/copy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copyType,
          framework,
          product,
          pageType,
          searchIntent,
          recommendedWordCount,
          audience,
          usp,
          tone,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Generation failed')
      }

      const data = await res.json()
      if (!data.content?.trim()) throw new Error('The generator returned an empty response')
      setDocument(data.document ?? null)
      setOutput(data.content)
      await saveGeneratedAsset(data.content)
      setAgentStatus('Saved to recent generations')
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : 'Generation failed')
      setAgentStatus('')
    } finally {
      clearInterval(statusTimer)
      setGenerating(false)
    }
  }, [audience, copyType, framework, pageType, product, recommendedWordCount, saveGeneratedAsset, searchIntent, tone, usp])

  const saveAsset = async () => {
    if (!output) return
    setSaving(true)
    try {
      await saveGeneratedAsset(output)
    } finally {
      setSaving(false)
    }
  }

  const deleteAsset = async (id: string) => {
    await fetch(`/api/copy?id=${id}`, { method: 'DELETE' })
    setSavedAssets(prev => prev.filter(a => a._id !== id))
  }

  const loadAsset = (asset: SavedAsset) => {
    setOutput(asset.content)
    setDocument(null)
    setProduct(asset.product || '')
    setCopyType(asset.copyType || 'landing')
    setView('generate')
  }

  useEffect(() => {
    const topic = searchParams.get('topic')
    const type = searchParams.get('type')
    if (!topic || !type) return
    const key = `${type}:${topic}`
    setPendingPrefillKey(key)
    setView('generate')
  }, [searchParams])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Copywriting</h1>
          <p className="text-xs text-[#555]">Conversion-focused copy generator · recent generations are saved automatically</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('generate')}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${view === 'generate' ? 'bg-[#DA7756]/20 text-[#DA7756]' : 'text-[#555] hover:text-white'}`}
          >
            Generate
          </button>
          <button
            onClick={() => setView('saved')}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${view === 'saved' ? 'bg-[#DA7756]/20 text-[#DA7756]' : 'text-[#555] hover:text-white'}`}
          >
            Saved {savedAssets.length > 0 && `(${savedAssets.length})`}
          </button>
        </div>
      </div>

      {view === 'saved' ? (
        <div className="flex-1 p-6">
          {savedAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-[#555]">No saved copy assets yet. Generate some and save them.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {savedAssets.map(asset => (
                <div key={asset._id} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{asset.name}</p>
                    <p className="text-xs text-[#555] mt-0.5">
                      {COPY_TYPES.find(t => t.id === asset.copyType)?.label || asset.copyType} ·{' '}
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => loadAsset(asset)}>Load</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteAsset(asset._id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Config panel */}
          <div className="w-72 shrink-0 border-r border-[#1E1E1E] p-5 space-y-5 overflow-y-auto">
            <div>
              <label className="text-xs text-[#555] block mb-2">What to write</label>
              <div className="grid grid-cols-2 gap-1.5">
                {COPY_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setCopyType(t.id)}
                    className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                      copyType === t.id
                        ? 'border-[#DA7756] bg-[#DA7756]/10'
                        : 'border-[#1E1E1E] hover:border-[#2A2A2A] bg-[#111]'
                    }`}
                  >
                    <span className="text-sm">{t.icon}</span>
                    <p className="text-xs font-medium text-white mt-0.5">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {['landing', 'product'].includes(copyType) && (
              <div>
                <label className="text-xs text-[#555] block mb-2">Framework</label>
                <div className="space-y-1">
                  {FRAMEWORKS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFramework(f.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        framework === f.id
                          ? 'border-[#DA7756] bg-[#DA7756]/10'
                          : 'border-[#1E1E1E] hover:border-[#2A2A2A] bg-[#111]'
                      }`}
                    >
                      <span className="text-xs font-medium text-white">{f.label}</span>
                      <span className="text-[10px] text-[#555] ml-1">{f.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#555] block mb-1">{copyType === 'seo-brief' ? 'Target keyword *' : 'Product / service *'}</label>
                <input
                  value={product}
                  onChange={e => setProduct(e.target.value)}
                  placeholder={copyType === 'seo-brief' ? 'e.g. institutional stock research' : 'e.g. AI email marketing tool'}
                  className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                />
              </div>
              {copyType === 'seo-brief' && (
                <>
                  <div>
                    <label className="text-xs text-[#555] block mb-1">Recommended page type</label>
                    <select
                      value={pageType}
                      onChange={e => setPageType(e.target.value)}
                      className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none"
                    >
                      {['landing-page', 'blog-post', 'feature-page', 'comparison-page', 'pillar-page'].map(type => (
                        <option key={type} value={type} className="bg-[#111]">{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#555] block mb-1">Search intent</label>
                    <select
                      value={searchIntent}
                      onChange={e => setSearchIntent(e.target.value)}
                      className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none"
                    >
                      {['commercial', 'informational', 'transactional', 'navigational'].map(intent => (
                        <option key={intent} value={intent} className="bg-[#111] capitalize">{intent}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#555] block mb-1">Recommended word count</label>
                    <input
                      value={recommendedWordCount}
                      onChange={e => setRecommendedWordCount(e.target.value)}
                      placeholder="e.g. 900-1400"
                      className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-[#555] block mb-1">Target audience</label>
                <input
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  placeholder="e.g. SaaS founders"
                  className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                />
              </div>
              {['seo-brief', 'landing', 'headline', 'value-prop'].includes(copyType) && (
                <div>
                  <label className="text-xs text-[#555] block mb-1">USP / key differentiator</label>
                  <input
                    value={usp}
                    onChange={e => setUsp(e.target.value)}
                    placeholder="e.g. 10x faster, no code needed"
                    className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-[#555] block mb-1">Tone</label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  {['professional', 'conversational', 'bold', 'friendly', 'urgent', 'authoritative'].map(t => (
                    <option key={t} value={t} className="bg-[#111] capitalize">{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button onClick={generate} loading={generating} disabled={!product} className="w-full">
              {copyType === 'seo-brief' ? 'Generate SEO Brief' : 'Generate Copy'}
            </Button>
            {agentStatus && <p className="text-[11px] text-[#DA7756]">{agentStatus}</p>}
            {generateError && <p className="text-[11px] text-red-400">{generateError}</p>}

            {savedAssets.length > 0 && (
              <div className="pt-2 border-t border-[#1E1E1E]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#555]">Recent generations</p>
                  <button
                    onClick={() => setView('saved')}
                    className="text-[11px] text-[#DA7756] hover:text-[#C4633F] transition-colors"
                  >
                    View all →
                  </button>
                </div>
                <div className="space-y-1.5">
                  {savedAssets.slice(0, 3).map(asset => (
                    <button
                      key={asset._id}
                      onClick={() => loadAsset(asset)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-[#1E1E1E] bg-[#111] hover:border-[#2A2A2A] transition-colors"
                    >
                      <p className="text-xs font-medium text-white truncate">{asset.name}</p>
                      <p className="text-[10px] text-[#555] mt-0.5">{new Date(asset.createdAt).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Output panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            {!output && !generating && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mb-4 text-2xl">
                  ✍️
                </div>
                <h2 className="text-base font-semibold text-white mb-2">Copy Generator</h2>
                <p className="text-sm text-[#555] max-w-sm">
                  Select a copy type, fill in your details, and generate copy or SEO briefs. Generated drafts are saved into Recent generations and the Saved tab.
                </p>
                {pendingPrefillKey && copyType === 'seo-brief' && product ? (
                  <div className="mt-5 max-w-md bg-[#111] border border-[#1E1E1E] rounded-2xl p-4 text-left">
                    <p className="text-sm font-semibold text-white">SEO brief ready</p>
                    <p className="text-xs text-[#555] mt-1">Keyword: <span className="text-[#A0A0A0]">{product}</span></p>
                    <p className="text-xs text-[#555] mt-1">{pageType} · {searchIntent} · {recommendedWordCount} words</p>
                    <Button onClick={generate} className="w-full mt-4">
                      Generate SEO Brief
                    </Button>
                  </div>
                ) : null}
                <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm text-left">
                  {FRAMEWORKS.map(f => (
                    <div key={f.id} className="bg-[#111] border border-[#1E1E1E] rounded-lg p-3">
                      <p className="text-xs font-semibold text-[#DA7756]">{f.label}</p>
                      <p className="text-[10px] text-[#555] mt-0.5">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(output || generating) && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {COPY_TYPES.find(t => t.id === copyType)?.icon} {COPY_TYPES.find(t => t.id === copyType)?.label}
                  </span>
                  {copyType === 'seo-brief' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/20">
                      {pageType} · {searchIntent}
                    </span>
                  )}
                  {generating && (
                    <span className="flex items-center gap-1.5 text-xs text-[#DA7756]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse" />
                      {agentStatus || 'Generating…'}
                    </span>
                  )}
                  </div>
                  {output && !generating && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={saveAsset} loading={saving}>
                        Save
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(output)}>
                        Copy All
                      </Button>
                    </div>
                  )}
                </div>

                {generating && !output && (
                  <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-6">
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 w-48 rounded bg-[#1E1E1E]" />
                      <div className="h-3 w-full rounded bg-[#1A1A1A]" />
                      <div className="h-3 w-5/6 rounded bg-[#1A1A1A]" />
                      <div className="h-24 rounded-xl bg-[#0D0D0D]" />
                      <div className="h-24 rounded-xl bg-[#0D0D0D]" />
                      <div className="h-24 rounded-xl bg-[#0D0D0D]" />
                    </div>
                  </div>
                )}

                {document ? (
                  <div className="space-y-3">
                    <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
                      <p className="text-lg font-semibold text-white">{document.title || 'Generated Draft'}</p>
                      {document.summary ? <p className="text-sm text-[#A0A0A0] mt-1">{document.summary}</p> : null}
                    </div>
                    {(document.sections ?? []).map(section => (
                      <div key={section.heading} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#DA7756] mb-3">{section.heading}</p>
                        <div className="space-y-2">
                          {(section.points ?? []).map((point, index) => (
                            <div key={`${section.heading}-${index}`} className="flex items-start gap-2">
                              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#DA7756] shrink-0" />
                              <p className="text-sm text-[#C0C0C0] leading-relaxed">{point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : output ? (
                  <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-6">
                    <div className="prose prose-sm max-w-none">
                      <pre className="text-sm text-[#C0C0C0] whitespace-pre-wrap font-sans leading-relaxed">
                        {output}
                      </pre>
                    </div>
                  </div>
                ) : null}

                {output && !generating && (
                  <Button variant="ghost" size="sm" onClick={() => { setOutput(''); generate() }}>
                    Regenerate
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
