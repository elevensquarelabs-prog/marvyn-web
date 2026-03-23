'use client'

import { useState, useRef, useEffect } from 'react'

export interface Competitor {
  domain: string
  title?: string
  url?: string
  description?: string
  organicTraffic?: number
  organicKeywords?: number
  domainRank?: number
  mainStrength?: string
  weakness?: string
  tag?: string
  added?: boolean
}

type Tag = 'direct' | 'indirect' | 'unset'

interface Props {
  competitors: Competitor[]
  domain: string
  onAdd: (domain: string, tag: Tag) => Promise<void>
  onDelete: (domain: string) => Promise<void>
  onTag: (domain: string, tag: Tag) => Promise<void>
}

function Favicon({ domain }: { domain: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt="" width={16} height={16}
      className="rounded-sm shrink-0"
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

const TAG_STYLES: Record<Tag, string> = {
  direct:   'bg-red-500/15 text-red-400 border-red-500/25',
  indirect: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  unset:    'bg-[#1E1E1E] text-[#555] border-[#2A2A2A]',
}
const TAG_LABELS: Record<Tag, string> = { direct: 'Direct', indirect: 'Indirect', unset: 'Untagged' }

function AddModal({ onAdd, onClose, existing }: { onAdd: Props['onAdd']; onClose: () => void; existing: string[] }) {
  const [val, setVal] = useState('')
  const [tag, setTag] = useState<'direct' | 'indirect'>('direct')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const clean = val.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
    if (!clean) { setErr('Enter a domain'); return }
    if (!/\.[a-z]{2,}$/i.test(clean)) { setErr('Enter a valid domain e.g. example.com'); return }
    if (existing.includes(clean)) { setErr('Already in your list'); return }
    setLoading(true)
    await onAdd(clean, tag)
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#111] border border-[#2A2A2A] rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-white">Add Competitor</p>
          <button onClick={onClose} className="text-[#555] hover:text-white">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Domain</label>
            <input
              value={val}
              onChange={e => { setVal(e.target.value); setErr('') }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="example.com"
              autoFocus
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#444] outline-none focus:border-[#DA7756]/50"
            />
            {err && <p className="text-xs text-red-400 mt-1.5">{err}</p>}
          </div>
          <div>
            <label className="text-xs text-[#555] block mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['direct', 'indirect'] as const).map(t => (
                <button key={t} onClick={() => setTag(t)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    tag === t
                      ? t === 'direct' ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                      : 'bg-[#0D0D0D] border-[#2A2A2A] text-[#555] hover:text-[#A0A0A0]'
                  }`}>
                  {t === 'direct' ? 'Direct' : 'Indirect'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={submit} disabled={loading}
            className="w-full bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {loading ? 'Adding…' : 'Add Competitor'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TagDropdown({ domain, tag, onTag }: { domain: string; tag: Tag; onTag: (domain: string, t: Tag) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest('[data-tag-dropdown]')?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(v => !v)
  }

  return (
    <div data-tag-dropdown="" className="relative">
      <button ref={btnRef} onClick={toggle}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer select-none ${TAG_STYLES[tag]}`}>
        {TAG_LABELS[tag]}
        <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden shadow-xl min-w-[110px]"
        >
          {(['direct', 'indirect', 'unset'] as Tag[]).map(t => (
            <button key={t} onClick={() => { onTag(domain, t); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#2A2A2A] transition-colors ${tag === t ? 'text-white font-semibold' : 'text-[#A0A0A0]'}`}>
              {TAG_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompetitorsPanel({ competitors, domain, onAdd, onDelete, onTag }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'direct' | 'indirect'>('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = competitors.filter(c => {
    if (filter === 'all') return true
    return (c.tag ?? 'unset') === filter
  })

  const counts = {
    all: competitors.length,
    direct: competitors.filter(c => c.tag === 'direct').length,
    indirect: competitors.filter(c => c.tag === 'indirect').length,
  }

  const handleDelete = async (dom: string) => {
    setDeleting(dom)
    await onDelete(dom)
    setConfirmDelete(null)
    setDeleting(null)
  }

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Competitors</h3>
          <p className="text-xs text-[#555] mt-0.5">
            {counts.direct} direct · {counts.indirect} indirect · {competitors.filter(c => !c.tag || c.tag === 'unset').length} untagged
          </p>
        </div>
        <div className="flex items-center gap-3">
          {competitors.length >= 5 && (
            <span className="text-xs text-[#555]">Max 5 competitors</span>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={competitors.length >= 5}
            className="flex items-center gap-2 text-xs font-semibold bg-[#DA7756] hover:bg-[#C4633F] disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition-colors">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
            Add Competitor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'direct', 'indirect'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-[#DA7756]/20 border-[#DA7756]/40 text-[#DA7756]' : 'bg-[#111] border-[#1E1E1E] text-[#555] hover:text-[#A0A0A0]'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f] ?? competitors.length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-[#1E1E1E] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[#555]">No {filter !== 'all' ? filter : ''} competitors</p>
            <button onClick={() => setShowModal(true)} className="text-xs text-[#DA7756] hover:underline">+ Add manually</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E1E] bg-[#0D0D0D]">
                  {['Domain', 'Type', 'Organic Traffic / mo', 'Keywords', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#555] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const tag = ((c.tag ?? 'unset') as Tag)
                  const isDeleting = deleting === c.domain
                  const traffic = c.organicTraffic && c.organicTraffic > 0
                    ? c.organicTraffic >= 1000000
                      ? `~${(c.organicTraffic / 1000000).toFixed(1)}M`
                      : c.organicTraffic >= 1000
                        ? `~${(c.organicTraffic / 1000).toFixed(1)}K`
                        : `~${Math.round(c.organicTraffic).toLocaleString()}`
                    : null
                  const keywords = c.organicKeywords && c.organicKeywords > 0
                    ? c.organicKeywords >= 1000
                      ? `${(c.organicKeywords / 1000).toFixed(1)}K`
                      : c.organicKeywords.toLocaleString()
                    : null
                  return (
                    <tr key={c.domain}
                      className={`border-b border-[#1A1A1A] last:border-0 transition-colors ${isDeleting ? 'opacity-40' : 'hover:bg-[#161616]'} ${i % 2 === 0 ? 'bg-[#111111]' : 'bg-[#0D0D0D]'}`}>

                      {/* Domain */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Favicon domain={c.domain} />
                          <div>
                            <div className="flex items-center gap-2">
                              <a href={c.url || `https://${c.domain}`} target="_blank" rel="noopener noreferrer"
                                className="font-semibold text-white hover:text-[#DA7756] transition-colors text-sm">
                                {c.domain}
                              </a>
                              {c.added && <span className="text-[10px] bg-[#DA7756]/15 text-[#DA7756] px-1.5 py-0.5 rounded border border-[#DA7756]/20">Added</span>}
                            </div>
                            {c.title && <p className="text-[11px] text-[#555] truncate max-w-[260px] mt-0.5">{c.title}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Tag */}
                      <td className="px-4 py-3.5">
                        <TagDropdown domain={c.domain} tag={tag} onTag={onTag} />
                      </td>

                      {/* Traffic */}
                      <td className="px-4 py-3.5">
                        {traffic
                          ? <span className="text-sm font-semibold text-white">{traffic}</span>
                          : <span className="text-[#333] text-xs">—</span>}
                      </td>

                      {/* Keywords */}
                      <td className="px-4 py-3.5">
                        {keywords
                          ? <span className="text-sm text-[#A0A0A0]">{keywords}</span>
                          : <span className="text-[#333] text-xs">—</span>}
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3.5">
                        {confirmDelete === c.domain ? (
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <button onClick={() => handleDelete(c.domain)}
                              className="text-[11px] text-red-400 hover:text-red-300 font-semibold">
                              {isDeleting ? 'Removing…' : 'Confirm'}
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="text-[11px] text-[#555] hover:text-[#A0A0A0]">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(c.domain)}
                            className="text-[11px] text-[#555] hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/8 rounded-lg px-2 py-1 transition-colors flex items-center gap-1.5">
                            <svg width="11" height="12" viewBox="0 0 11 13" fill="none">
                              <path d="M1 3h9M3.5 3V2a1 1 0 012 0v1M4 5.5v4M7 5.5v4M2 3l.6 8a1 1 0 001 .9h3.8a1 1 0 001-.9L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[#555]">
        Found via Google SERP for <span className="text-[#A0A0A0]">{domain}</span>. Re-run audit to refresh DR &amp; traffic data.
      </p>

      {showModal && (
        <AddModal
          onAdd={onAdd}
          onClose={() => setShowModal(false)}
          existing={competitors.map(c => c.domain)}
        />
      )}
    </div>
  )
}
