'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/shared/Button'

const COPY_TYPES = [
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

export default function CopyPage() {
  const [copyType, setCopyType] = useState('landing')
  const [framework, setFramework] = useState('aida')
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  const [usp, setUsp] = useState('')
  const [tone, setTone] = useState('professional')
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState('')
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>([])
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'generate' | 'saved'>('generate')

  const loadSaved = useCallback(async () => {
    const res = await fetch('/api/copy')
    if (res.ok) {
      const data = await res.json()
      setSavedAssets(data.assets || [])
    }
  }, [])

  useEffect(() => { loadSaved() }, [loadSaved])

  const generate = async () => {
    if (!product) return
    setGenerating(true)
    setOutput('')

    const typeLabel = COPY_TYPES.find(t => t.id === copyType)?.label || copyType
    const frameworkData = FRAMEWORKS.find(f => f.id === framework)

    const prompts: Record<string, string> = {
      landing: `Write a complete landing page copy for: "${product}".
Target audience: ${audience || 'general'}. USP: ${usp || 'not specified'}. Tone: ${tone}.
Framework: ${frameworkData?.label} (${frameworkData?.description}).

Include:
1. HEADLINE (power headline that grabs attention)
2. SUB-HEADLINE (expand on the promise)
3. HERO COPY (2-3 sentences, lead with biggest benefit)
4. 3 KEY BENEFITS (each with title + 1-sentence description)
5. SOCIAL PROOF PLACEHOLDER (what type of proof to include)
6. PRIMARY CTA (button text + surrounding copy)
7. SECONDARY CTA (for lower-intent visitors)
8. OBJECTION CRUSHER (address top 1-2 objections)`,

      ad: `Write 5 Google Ads + 3 Meta Ads for: "${product}".
Audience: ${audience || 'general'}. Tone: ${tone}.

Google Ads format (each):
Headline 1 (30 chars max): ...
Headline 2 (30 chars max): ...
Headline 3 (30 chars max): ...
Description 1 (90 chars max): ...
Description 2 (90 chars max): ...

Meta Ads format (each):
Primary text (125 chars): ...
Headline (40 chars): ...
Description (30 chars): ...`,

      product: `Write a product description for: "${product}".
Audience: ${audience}. Framework: FAB (Features, Advantages, Benefits). Tone: ${tone}.

Include:
- Opening hook (1 line)
- Main description (100-150 words, benefit-focused)
- 4-5 bullet point features (each starting with benefit)
- Closing CTA`,

      headline: `Generate 10 headline variations for: "${product}".
Audience: ${audience || 'general'}. USP: ${usp || ''}.

Include variety:
- 2 number-led headlines
- 2 how-to headlines
- 2 question headlines
- 2 direct benefit headlines
- 2 curiosity/intrigue headlines

For each, also note the hook type.`,

      cta: `Generate 15 CTA variations for: "${product}".

Group by intent:
- 5 High-intent (ready to buy): ...
- 5 Mid-intent (interested, not ready): ...
- 5 Low-intent (just browsing): ...

Each CTA should be 2-6 words. Add a 1-line note on when to use each.`,

      'value-prop': `Create a value proposition framework for: "${product}".
Audience: ${audience || 'general'}. USP: ${usp || ''}.

Deliver:
1. PRIMARY TAGLINE (5-10 words, memorable)
2. ELEVATOR PITCH (1 sentence, <30 words)
3. THREE VALUE PILLARS (each with: pillar name, 1-line statement, 2-line expansion)
4. PROOF HOOK (what proof would make this credible)`,
    }

    try {
      const prompt = prompts[copyType] || prompts.landing
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, skillId: 'copywriting' }),
      })

      if (!res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'delta') {
              setOutput(prev => prev + data.content)
            }
          } catch {}
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  const saveAsset = async () => {
    if (!output) return
    setSaving(true)
    try {
      const typeLabel = COPY_TYPES.find(t => t.id === copyType)?.label || copyType
      const name = `${typeLabel} — ${product.slice(0, 30)}`
      await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, copyType, framework, product, audience, content: output }),
      })
      await loadSaved()
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
    setProduct(asset.product || '')
    setCopyType(asset.copyType || 'landing')
    setView('generate')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Copywriting</h1>
          <p className="text-xs text-[#555]">Conversion-focused copy generator</p>
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
                <label className="text-xs text-[#555] block mb-1">Product / service *</label>
                <input
                  value={product}
                  onChange={e => setProduct(e.target.value)}
                  placeholder="e.g. AI email marketing tool"
                  className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#555] block mb-1">Target audience</label>
                <input
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                  placeholder="e.g. SaaS founders"
                  className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
                />
              </div>
              {['landing', 'headline', 'value-prop'].includes(copyType) && (
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
              Generate Copy
            </Button>
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
                  Select a copy type, fill in your product details, and generate conversion-optimised copy using proven frameworks.
                </p>
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
                    {generating && (
                      <span className="flex items-center gap-1.5 text-xs text-[#DA7756]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse" />
                        Writing…
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

                <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-6">
                  <div className="prose prose-sm max-w-none">
                    <pre className="text-sm text-[#C0C0C0] whitespace-pre-wrap font-sans leading-relaxed">
                      {output}
                      {generating && <span className="inline-block w-1.5 h-4 bg-[#DA7756] animate-pulse ml-0.5 align-middle" />}
                    </pre>
                  </div>
                </div>

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
