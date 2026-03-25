'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { SocialPostCard } from '@/components/social/SocialPostCard'
import { SocialCalendar } from '@/components/social/SocialCalendar'
import { Composer } from '@/components/social/Composer'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'

interface SocialPost {
  _id: string
  platform: 'linkedin' | 'facebook' | 'instagram'
  content: string
  hashtags?: string[]
  status: string
  scheduledAt?: string
  mediaUrl?: string
  [key: string]: unknown
}

const platformIcon: Record<string, string> = { linkedin: 'in', facebook: 'f', instagram: 'ig' }
const platformColor: Record<string, string> = {
  linkedin: 'bg-blue-100 text-blue-800',
  facebook: 'bg-indigo-100 text-indigo-800',
  instagram: 'bg-pink-100 text-pink-800',
}

export default function SocialPage() {
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [plannerTopic, setPlannerTopic] = useState('')
  const [plannerPlatforms, setPlannerPlatforms] = useState<string[]>(['linkedin'])
  const [plannerDays, setPlannerDays] = useState(7)
  const [planning, setPlanning] = useState(false)
  const [planOutput, setPlanOutput] = useState('')
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Calendar navigation
  const now = new Date()
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calYear, setCalYear] = useState(now.getFullYear())

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/social')
      const data = await res.json()
      setPosts(data.posts || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    const topic = searchParams.get('topic')
    if (!topic) return
    setPlannerTopic(prev => prev || topic)
    setPlannerOpen(true)
  }, [searchParams])

  const approvePost = async (post: SocialPost) => {
    setActionLoading(true)
    setActionError('')
    const isFutureScheduled = post.scheduledAt && new Date(post.scheduledAt) > new Date()
    let ok = true
    if (isFutureScheduled) {
      const res = await fetch(`/api/social/${post._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'scheduled' }),
      })
      if (!res.ok) { setActionError('Failed to approve post'); ok = false }
    } else {
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post._id }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error || 'Publish failed. Check platform connection in Settings.'); ok = false }
    }
    setActionLoading(false)
    loadPosts()
    if (ok) setSelectedPost(null)
  }

  const revokePost = async (postId: string) => {
    setActionLoading(true)
    setActionError('')
    const res = await fetch(`/api/social/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending_approval' }),
    })
    setActionLoading(false)
    if (res.ok) { setSelectedPost(null); loadPosts() }
    else setActionError('Failed to revoke post')
  }

  const rejectPost = async (postId: string) => {
    setActionLoading(true)
    setActionError('')
    await fetch(`/api/social/${postId}`, { method: 'DELETE' })
    setActionLoading(false)
    setSelectedPost(null)
    loadPosts()
  }

  const generateWeekPlan = async () => {
    setPlanning(true)
    setPlanOutput('')
    const platforms = plannerPlatforms.join(', ')
    const prompt = `Create a ${plannerDays}-day social media content plan for: "${plannerTopic || 'our brand'}".
Platforms: ${platforms}.

For each day, output:
DAY 1 (Platform):
Post type: [Educational/Inspirational/Promotional/Community]
Hook: [First line that stops the scroll]
Content: [Full post 100-200 words]
Hashtags: #tag1 #tag2 #tag3
---

Use the content pillars framework: 40% Educational, 20% Inspirational, 20% Promotional, 20% Community.
Vary post formats: story posts, listicles, questions, behind-the-scenes.`

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, skillId: 'social-content' }),
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
            if (data.type === 'delta') setPlanOutput(prev => prev + data.content)
          } catch {}
        }
      }
    } finally {
      setPlanning(false)
    }
  }

  const filtered = filter === 'all' ? posts : posts.filter(p => p.platform === filter)
  const pending = filtered.filter(p => p.status === 'pending_approval')
  const scheduled = filtered.filter(p => p.status === 'scheduled')
  const published = filtered.filter(p => p.status === 'published')

  const columns = [
    { label: 'Pending Approval', count: pending.length, posts: pending, accent: 'text-[#92610A]' },
    { label: 'Scheduled',        count: scheduled.length, posts: scheduled, accent: 'text-[#1E40AF]' },
    { label: 'Published',        count: published.length, posts: published, accent: 'text-[#166534]' },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Social</h1>
          <p className="text-xs text-[var(--text-muted)]">{posts.length} posts</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPlannerOpen(true)}>Plan Week</Button>
          <Button size="sm" onClick={() => setComposerOpen(true)}>+ New Post</Button>
        </div>
      </div>

      {/* Platform filter pills */}
      <div className="px-6 py-3 border-b border-[var(--border)] flex gap-2 shrink-0">
        {['all', 'linkedin', 'facebook', 'instagram'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
              filter === f
                ? 'bg-[#DA7756] text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Calendar with navigation */}
        <SocialCalendar
          posts={filtered}
          onPostClick={(p) => setSelectedPost(p as SocialPost)}
          month={calMonth}
          year={calYear}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
        />

        {/* Queue columns with dividers */}
        <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
          {columns.map((col, idx) => (
            <div key={col.label} className={idx === 0 ? 'pr-5' : idx === 1 ? 'px-5' : 'pl-5'}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className={`text-xs font-semibold ${col.accent}`}>{col.label}</h3>
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 rounded-full">{col.count}</span>
              </div>
              <div className="space-y-2">
                {col.posts.map(post => (
                  <SocialPostCard
                    key={post._id}
                    post={post}
                    onClick={() => setSelectedPost(post)}
                  />
                ))}
                {col.posts.length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)] text-center py-8">No posts</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post detail drawer */}
      {selectedPost && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedPost(null)} />
          <div className="fixed right-0 top-0 h-full w-[420px] z-50 bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold px-3 py-1 rounded-lg capitalize ${platformColor[selectedPost.platform] || 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}>
                  {selectedPost.platform}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${
                  selectedPost.status === 'pending_approval' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  selectedPost.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  selectedPost.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' :
                  'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]'
                }`}>
                  {selectedPost.status.replace('_', ' ')}
                </span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Post content */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Content</p>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              {/* Hashtags */}
              {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPost.hashtags.map(h => (
                      <span key={h} className="text-xs px-2 py-0.5 bg-[#DA7756]/10 text-[#DA7756] rounded-full">#{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule info */}
              {selectedPost.scheduledAt && (
                <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Scheduled for</p>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{new Date(selectedPost.scheduledAt).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {actionError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-700">{actionError}</p>
                </div>
              )}
            </div>

            {/* Drawer actions */}
            <div className="px-6 py-5 border-t border-[var(--border)] space-y-3">
              {selectedPost.status === 'pending_approval' && (
                <>
                  <Button onClick={() => approvePost(selectedPost)} loading={actionLoading} className="w-full">
                    {selectedPost.scheduledAt && new Date(selectedPost.scheduledAt) > new Date()
                      ? '✓ Approve & Schedule'
                      : '✓ Approve & Publish Now'}
                  </Button>
                  <Button variant="danger" onClick={() => rejectPost(selectedPost._id)} loading={actionLoading} className="w-full">
                    Reject & Delete
                  </Button>
                </>
              )}
              {selectedPost.status === 'scheduled' && (
                <Button variant="secondary" onClick={() => revokePost(selectedPost._id)} loading={actionLoading} className="w-full">
                  ↩ Revoke Schedule
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSaved={loadPosts}
      />

      {/* Content Planner Modal */}
      <Modal open={plannerOpen} onClose={() => setPlannerOpen(false)} title="Content Calendar Planner" size="lg">
        <div className="flex h-[500px]">
          <div className="w-64 shrink-0 border-r border-[var(--border)] p-5 space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Topic / theme</label>
              <input
                value={plannerTopic}
                onChange={e => setPlannerTopic(e.target.value)}
                placeholder="e.g. product launch, brand awareness"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#DA7756]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-2">Platforms</label>
              <div className="space-y-1.5">
                {['linkedin', 'facebook', 'instagram'].map(p => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plannerPlatforms.includes(p)}
                      onChange={e => {
                        if (e.target.checked) setPlannerPlatforms(prev => [...prev, p])
                        else setPlannerPlatforms(prev => prev.filter(x => x !== p))
                      }}
                      className="accent-[#DA7756]"
                    />
                    <span className="text-xs text-[var(--text-secondary)] capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Days: {plannerDays}</label>
              <input
                type="range" min={3} max={14} value={plannerDays}
                onChange={e => setPlannerDays(parseInt(e.target.value))}
                className="w-full accent-[#DA7756]"
              />
            </div>
            <Button onClick={generateWeekPlan} loading={planning} disabled={plannerPlatforms.length === 0} className="w-full">
              Generate Plan
            </Button>
          </div>
          <div className="flex-1 p-5 overflow-y-auto">
            {!planOutput && !planning && (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <p className="text-2xl mb-3">📅</p>
                  <p className="text-sm text-[var(--text-muted)]">Set your topic and platforms, then generate a full content plan with ready-to-use posts.</p>
                </div>
              </div>
            )}
            {(planOutput || planning) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {planning && <span className="text-xs text-[#DA7756] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] animate-pulse" />Generating…</span>}
                  {planOutput && !planning && (
                    <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(planOutput)}>Copy Plan</Button>
                  )}
                </div>
                <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans leading-relaxed">
                  {planOutput}
                  {planning && <span className="inline-block w-1.5 h-4 bg-[#DA7756] animate-pulse ml-0.5 align-middle" />}
                </pre>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
