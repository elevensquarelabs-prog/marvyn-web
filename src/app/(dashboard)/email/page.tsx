'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/shared/Button'

interface EmailStep {
  subject: string
  preview: string
  body: string
  day: number
}

interface SavedSequence {
  _id: string
  name: string
  goal: string
  product: string
  steps: EmailStep[]
  createdAt: string
}

const SEQUENCE_GOALS = [
  { id: 'welcome', label: 'Welcome Sequence', description: 'Onboard new subscribers' },
  { id: 'nurture', label: 'Nurture Sequence', description: 'Build trust over time' },
  { id: 'sales', label: 'Sales Sequence', description: 'Convert leads to customers' },
  { id: 're-engagement', label: 'Re-engagement', description: 'Win back inactive contacts' },
]

export default function EmailPage() {
  const [goal, setGoal] = useState('welcome')
  const [audience, setAudience] = useState('')
  const [product, setProduct] = useState('')
  const [emailCount, setEmailCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [sequence, setSequence] = useState<EmailStep[]>([])
  const [selectedEmail, setSelectedEmail] = useState<number | null>(null)
  const [streamText, setStreamText] = useState('')
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([])
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'generate' | 'saved'>('generate')

  const loadSaved = useCallback(async () => {
    const res = await fetch('/api/email')
    if (res.ok) {
      const data = await res.json()
      setSavedSequences(data.sequences || [])
    }
  }, [])

  useEffect(() => { loadSaved() }, [loadSaved])

  const generate = async () => {
    if (!audience || !product) return
    setGenerating(true)
    setSequence([])
    setStreamText('')
    setSelectedEmail(null)

    try {
      const goalLabel = SEQUENCE_GOALS.find(g => g.id === goal)?.label || goal
      const prompt = `Create a ${emailCount}-email ${goalLabel} sequence for: "${product}". Target audience: ${audience}.

For each email, output EXACTLY this format (no extra text before or between):
EMAIL 1 | Day 1 | Subject: [subject] | Preview: [preview text]
[Full email body here — 150-250 words, professional but conversational]
---
EMAIL 2 | Day 3 | Subject: [subject] | Preview: [preview text]
[Full email body]
---

Use proven copywriting: hook in first line, clear value, specific CTA. Adapt tone based on the sequence goal.`

      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, skillId: 'email-sequence' }),
      })

      if (!res.body) return

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'delta') {
              fullText += data.content
              setStreamText(fullText)
            } else if (data.type === 'done') {
              const parsed = parseEmailSequence(fullText)
              setSequence(parsed)
              setStreamText('')
              if (parsed.length > 0) setSelectedEmail(0)
            }
          } catch {}
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  const parseEmailSequence = (text: string): EmailStep[] => {
    const emails: EmailStep[] = []
    const sections = text.split(/^---$/m).map(s => s.trim()).filter(Boolean)

    for (const section of sections) {
      const headerMatch = section.match(/EMAIL\s*\d+\s*\|\s*Day\s*(\d+)\s*\|\s*Subject:\s*(.+?)\s*\|\s*Preview:\s*(.+)/i)
      if (headerMatch) {
        const day = parseInt(headerMatch[1])
        const subject = headerMatch[2].trim()
        const preview = headerMatch[3].trim()
        const bodyStart = section.indexOf('\n', section.indexOf('Preview:') + 1)
        const body = bodyStart > -1 ? section.slice(bodyStart).trim() : ''
        emails.push({ subject, preview, body, day })
      }
    }

    if (emails.length === 0 && text.length > 100) {
      const fallbackSections = text.split(/\n(?=EMAIL\s*\d+)/i).filter(s => s.trim())
      for (let i = 0; i < fallbackSections.length; i++) {
        const s = fallbackSections[i]
        const subjectMatch = s.match(/Subject:\s*(.+)/i)
        const previewMatch = s.match(/Preview:\s*(.+)/i)
        if (subjectMatch) {
          emails.push({
            subject: subjectMatch[1].trim(),
            preview: previewMatch?.[1].trim() || '',
            body: s,
            day: (i === 0 ? 1 : i * 3),
          })
        }
      }
    }

    return emails
  }

  const saveSequence = async () => {
    if (!sequence.length) return
    setSaving(true)
    try {
      const goalLabel = SEQUENCE_GOALS.find(g => g.id === goal)?.label || goal
      const name = `${goalLabel} — ${product.slice(0, 30)}`
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, goal, product, audience, emailCount, steps: sequence }),
      })
      await loadSaved()
    } finally {
      setSaving(false)
    }
  }

  const deleteSequence = async (id: string) => {
    await fetch(`/api/email?id=${id}`, { method: 'DELETE' })
    setSavedSequences(prev => prev.filter(s => s._id !== id))
  }

  const loadSequence = (seq: SavedSequence) => {
    setSequence(seq.steps)
    setProduct(seq.product || '')
    setGoal(seq.goal || 'welcome')
    setSelectedEmail(0)
    setView('generate')
  }

  const selectedEmailData = selectedEmail !== null ? sequence[selectedEmail] : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Email Sequences</h1>
          <p className="text-xs text-[#555]">AI-powered email sequence builder</p>
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
            Saved {savedSequences.length > 0 && `(${savedSequences.length})`}
          </button>
        </div>
      </div>

      {view === 'saved' ? (
        <div className="flex-1 p-6">
          {savedSequences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-[#555]">No saved sequences yet. Generate one and save it.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {savedSequences.map(seq => (
                <div key={seq._id} className="bg-[#111] border border-[#1E1E1E] rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{seq.name}</p>
                    <p className="text-xs text-[#555] mt-0.5">
                      {seq.steps.length} emails · {new Date(seq.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => loadSequence(seq)}>Load</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteSequence(seq._id)}>Delete</Button>
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
              <label className="text-xs text-[#555] block mb-2">Sequence goal</label>
              <div className="space-y-1.5">
                {SEQUENCE_GOALS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      goal === g.id
                        ? 'border-[#DA7756] bg-[#DA7756]/10'
                        : 'border-[#1E1E1E] hover:border-[#2A2A2A] bg-[#111]'
                    }`}
                  >
                    <p className="text-xs font-medium text-white">{g.label}</p>
                    <p className="text-[10px] text-[#555]">{g.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Product / offer</label>
              <input
                value={product}
                onChange={e => setProduct(e.target.value)}
                placeholder="e.g. SaaS tool for marketers"
                className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
              />
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Target audience</label>
              <input
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="e.g. startup founders, B2B marketers"
                className="w-full bg-[#111] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white placeholder-[#333] outline-none focus:border-[#DA7756]/50"
              />
            </div>

            <div>
              <label className="text-xs text-[#555] block mb-1">Number of emails: {emailCount}</label>
              <input
                type="range"
                min={3}
                max={10}
                value={emailCount}
                onChange={e => setEmailCount(parseInt(e.target.value))}
                className="w-full accent-[#DA7756]"
              />
              <div className="flex justify-between text-[10px] text-[#555] mt-0.5">
                <span>3</span><span>10</span>
              </div>
            </div>

            <Button
              onClick={generate}
              loading={generating}
              disabled={!audience || !product}
              className="w-full"
            >
              Generate Sequence
            </Button>

            {sequence.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#555]">{sequence.length} emails generated</p>
                  <Button size="sm" variant="secondary" onClick={saveSequence} loading={saving}>
                    Save
                  </Button>
                </div>
                {sequence.map((email, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEmail(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      selectedEmail === i
                        ? 'border-[#DA7756] bg-[#DA7756]/10'
                        : 'border-[#1E1E1E] hover:border-[#2A2A2A] bg-[#111]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[10px] text-[#DA7756] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{email.subject}</p>
                        <p className="text-[10px] text-[#555]">Day {email.day}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Email view */}
          <div className="flex-1 p-6 overflow-y-auto">
            {generating && !sequence.length && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-[#111] border border-[#1E1E1E] rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-2 h-2 bg-[#DA7756] rounded-full animate-pulse" />
                    <p className="text-sm text-[#A0A0A0]">Generating your sequence…</p>
                  </div>
                  {streamText && (
                    <pre className="text-xs text-[#555] whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                      {streamText}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {!generating && sequence.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mb-4 text-2xl">
                  ✉
                </div>
                <h2 className="text-base font-semibold text-white mb-2">Email Sequence Builder</h2>
                <p className="text-sm text-[#555] max-w-sm">
                  Fill in the details on the left and generate a complete email sequence with subject lines and body copy.
                </p>
              </div>
            )}

            {selectedEmailData && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#555]">Email {selectedEmail! + 1} of {sequence.length}</span>
                  <span className="px-2 py-0.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded text-xs text-[#A0A0A0]">
                    Day {selectedEmailData.day}
                  </span>
                </div>

                <div className="bg-[#111] border border-[#1E1E1E] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1E1E1E] space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-[#555] w-14 shrink-0 pt-0.5">Subject</span>
                      <p className="text-sm font-medium text-white">{selectedEmailData.subject}</p>
                    </div>
                    {selectedEmailData.preview && (
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-[#555] w-14 shrink-0 pt-0.5">Preview</span>
                        <p className="text-xs text-[#A0A0A0]">{selectedEmailData.preview}</p>
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-5">
                    <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap leading-relaxed">
                      {selectedEmailData.body || 'Email body generated above — adjust the sequence goal or try regenerating.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const text = `Subject: ${selectedEmailData.subject}\n\nPreview: ${selectedEmailData.preview}\n\n${selectedEmailData.body}`
                      navigator.clipboard.writeText(text)
                    }}
                  >
                    Copy Email
                  </Button>
                  {selectedEmail! > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedEmail(selectedEmail! - 1)}>
                      ← Previous
                    </Button>
                  )}
                  {selectedEmail! < sequence.length - 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedEmail(selectedEmail! + 1)}>
                      Next →
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
