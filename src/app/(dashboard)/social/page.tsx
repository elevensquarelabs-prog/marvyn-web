'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { SocialPostCard } from '@/components/social/SocialPostCard'
import { SocialCalendar } from '@/components/social/SocialCalendar'
import { Composer } from '@/components/social/Composer'
import { SocialWorkspaceTabs } from '@/components/social/SocialWorkspaceTabs'
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
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Social Planner</h1>
          <p className="text-xs text-[var(--text-muted)]">Schedule and publish across your connected platforms</p>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DA7756]/10 border border-[#DA7756]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756]" />
            <span className="text-xs font-medium text-[#DA7756]">Coming Soon</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Social Publishing</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Direct publishing to LinkedIn, Facebook, and Instagram is on its way. We&apos;re completing platform verification requirements and will enable this feature shortly.
            </p>
          </div>

          {/* Features preview */}
          <div className="text-left space-y-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-5">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">What&apos;s coming</p>
            {[
              'One-click publish to LinkedIn, Facebook & Instagram',
              'AI-generated content calendar with scheduling',
              'Post approval workflow with queue management',
              'Media upload with platform-optimised previews',
            ].map(item => (
              <div key={item} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--surface)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--text-secondary)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
