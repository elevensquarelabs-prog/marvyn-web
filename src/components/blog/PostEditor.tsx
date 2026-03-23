'use client'

import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { Badge } from '@/components/shared/Badge'

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
}

export function PostEditor({
  post,
  open,
  onClose,
  onSave,
}: {
  post: Post | null
  open: boolean
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState<Partial<Post>>({})
  const [saving, setSaving] = useState(false)

  const current = { ...post, ...form }

  const update = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const handleSave = async (status?: string) => {
    if (!post) return
    setSaving(true)
    try {
      await fetch(`/api/blog/${post._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(status ? { status } : {}) }),
      })
      onSave()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!post) return null

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <div className="flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E]">
          <div className="flex items-center gap-3">
            <Badge variant={post.status === 'pending_approval' ? 'warning' : post.status === 'published' ? 'success' : 'default'}>
              {post.status.replace('_', ' ')}
            </Badge>
            {current.seoScore && (
              <Badge variant={current.seoScore >= 80 ? 'success' : current.seoScore >= 60 ? 'warning' : 'danger'}>
                SEO {current.seoScore}
              </Badge>
            )}
            {current.wordCount && <span className="text-xs text-[#555]">{current.wordCount} words</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => handleSave('draft')}>Save Draft</Button>
            {post.status === 'pending_approval' && (
              <Button size="sm" onClick={() => handleSave('scheduled')} loading={saving}>
                Approve & Schedule
              </Button>
            )}
            {post.status !== 'published' && (
              <Button size="sm" onClick={() => handleSave('published')} loading={saving}>
                Publish Now
              </Button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Title */}
          <input
            value={current.title || ''}
            onChange={e => update('title', e.target.value)}
            className="w-full bg-transparent text-2xl font-bold text-white placeholder-[#333] outline-none border-b border-[#1E1E1E] pb-3"
            placeholder="Post title…"
          />

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#555] block mb-1">Target keyword</label>
              <input
                value={current.targetKeyword || ''}
                onChange={e => update('targetKeyword', e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-[#DA7756]/50"
                placeholder="main keyword"
              />
            </div>
            <div>
              <label className="text-xs text-[#555] block mb-1">Schedule date</label>
              <input
                type="datetime-local"
                value={current.scheduledAt ? new Date(current.scheduledAt).toISOString().slice(0, 16) : ''}
                onChange={e => update('scheduledAt', new Date(e.target.value).toISOString())}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-[#DA7756]/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#555] block mb-1">Meta description (150-160 chars)</label>
            <input
              value={current.metaDescription || ''}
              onChange={e => update('metaDescription', e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded px-3 py-1.5 text-sm text-white outline-none focus:border-[#DA7756]/50"
              placeholder="Meta description…"
              maxLength={160}
            />
            <span className="text-[10px] text-[#555]">{(current.metaDescription || '').length}/160</span>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs text-[#555] block mb-1">Content (Markdown)</label>
            <textarea
              value={current.content || ''}
              onChange={e => update('content', e.target.value)}
              rows={20}
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded px-4 py-3 text-sm text-white font-mono outline-none focus:border-[#DA7756]/50 resize-y"
              placeholder="Write your blog post in markdown…"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
