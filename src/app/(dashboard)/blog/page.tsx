'use client'

import { useState, useEffect, useCallback } from 'react'
import { BlogCalendar } from '@/components/blog/BlogCalendar'
import { PostCard } from '@/components/blog/PostCard'
import { PostEditor } from '@/components/blog/PostEditor'
import { Button } from '@/components/shared/Button'
import { Modal } from '@/components/shared/Modal'

interface Post {
  _id: string
  title: string
  content: string
  metaDescription?: string
  targetKeyword?: string
  tags?: string[]
  status: string
  seoScore?: number
  wordCount?: number
  scheduledAt?: string
  createdAt: string
  [key: string]: unknown
}

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [topics, setTopics] = useState('')
  const [count, setCount] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
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
      const res = await fetch('/api/blog')
      const data = await res.json()
      setPosts(data.posts || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  const generate = async () => {
    setGenerating(true)
    setGenerateError('')
    try {
      const topicList = topics.split('\n').map(t => t.trim()).filter(Boolean)
      const res = await fetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true, topics: topicList, count }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error || 'Generation failed. Check your API key in Settings.')
        return
      }
      await loadPosts()
      setGenerateOpen(false)
      setTopics('')
    } finally {
      setGenerating(false)
    }
  }

  const approvePost = async (post: Post) => {
    setActionLoading(true)
    setActionError('')
    const isFuture = post.scheduledAt && new Date(post.scheduledAt) > new Date()
    const newStatus = isFuture ? 'scheduled' : 'published'
    const res = await fetch(`/api/blog/${post._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setActionLoading(false)
    if (res.ok) { setSelectedPost(null); loadPosts() }
    else setActionError('Failed to approve post')
  }

  const revokePost = async (postId: string) => {
    setActionLoading(true)
    setActionError('')
    const res = await fetch(`/api/blog/${postId}`, {
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
    await fetch(`/api/blog/${postId}`, { method: 'DELETE' })
    setActionLoading(false)
    setSelectedPost(null)
    loadPosts()
  }

  const pending = posts.filter(p => p.status === 'pending_approval')
  const scheduled = posts.filter(p => p.status === 'scheduled')
  const published = posts.filter(p => p.status === 'published')

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
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Blog</h1>
          <p className="text-xs text-[var(--text-muted)]">{posts.length} posts</p>
        </div>
        <Button size="sm" onClick={() => setGenerateOpen(true)}>Generate Posts</Button>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Calendar with navigation */}
        <BlogCalendar
          posts={posts}
          onPostClick={(p) => setSelectedPost(p as Post)}
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
                  <PostCard key={post._id} post={post} onClick={() => setSelectedPost(post)} />
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
          <div className="fixed right-0 top-0 h-full w-[440px] z-50 bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${
                  selectedPost.status === 'pending_approval' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  selectedPost.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  selectedPost.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' :
                  'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]'
                }`}>
                  {selectedPost.status.replace('_', ' ')}
                </span>
                {selectedPost.seoScore && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    selectedPost.seoScore >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                    selectedPost.seoScore >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    SEO {selectedPost.seoScore}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <h2 className="text-base font-semibold text-[var(--text-primary)] leading-snug">{selectedPost.title}</h2>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
                {selectedPost.targetKeyword && (
                  <span className="flex items-center gap-1">🎯 {selectedPost.targetKeyword}</span>
                )}
                {selectedPost.wordCount && (
                  <span>{selectedPost.wordCount} words</span>
                )}
              </div>

              {/* Meta description */}
              {selectedPost.metaDescription && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Meta Description</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{selectedPost.metaDescription}</p>
                </div>
              )}

              {/* Content preview */}
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Content Preview</p>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed line-clamp-6 whitespace-pre-wrap">{selectedPost.content}</p>
              </div>

              {/* Tags */}
              {selectedPost.tags && selectedPost.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedPost.tags as string[]).map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 bg-[#DA7756]/10 text-[#DA7756] rounded-full">{t}</span>
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
            <div className="px-6 py-5 border-t border-[var(--border)] space-y-2">
              <Button
                variant="secondary"
                onClick={() => { setEditorOpen(true) }}
                className="w-full"
              >
                ✏️ Edit Post
              </Button>
              {selectedPost.status === 'pending_approval' && (
                <>
                  <Button onClick={() => approvePost(selectedPost)} loading={actionLoading} className="w-full">
                    {selectedPost.scheduledAt && new Date(selectedPost.scheduledAt) > new Date()
                      ? '✓ Approve & Schedule'
                      : '✓ Approve & Publish'}
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

      {/* Generate modal */}
      <Modal open={generateOpen} onClose={() => { setGenerateOpen(false); setGenerateError('') }} title="Generate Blog Posts" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">Topics (one per line)</label>
            <textarea
              value={topics}
              onChange={e => setTopics(e.target.value)}
              rows={5}
              placeholder={"AI in marketing\nContent strategy tips\nSEO best practices"}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#DA7756]/50 resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1.5">Number of posts (max 5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={count}
              onChange={e => setCount(parseInt(e.target.value))}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>
          {generateError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700">{generateError}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setGenerateOpen(false); setGenerateError('') }}>Cancel</Button>
            <Button size="sm" onClick={generate} loading={generating}>Generate</Button>
          </div>
        </div>
      </Modal>

      {/* Full post editor */}
      <PostEditor
        post={selectedPost}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={() => { loadPosts(); setEditorOpen(false); setSelectedPost(null) }}
      />
    </div>
  )
}
