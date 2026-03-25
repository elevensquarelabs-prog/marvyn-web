'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'

const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0A66C2',
  facebook: '#1877F2',
  instagram: '#E1306C',
}

interface MediaFile {
  file: File
  previewUrl: string
  type: 'image' | 'video'
  uploadedKey?: string
  uploadedUrl?: string
}

interface ComposerProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Composer({ open, onClose, onSaved }: ComposerProps) {
  const [brandName, setBrandName] = useState('Your Brand')
  const [platform, setPlatform] = useState<'linkedin' | 'facebook' | 'instagram'>('linkedin')
  const [content, setContent] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [topic, setTopic] = useState('')
  const [media, setMedia] = useState<MediaFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings/brand').then(r => r.json()).then(d => {
      if (d.brand?.name) setBrandName(d.brand.name)
    }).catch(() => {})
  }, [])

  const limit = PLATFORM_LIMITS[platform]
  const charColor = content.length > limit ? 'text-red-400' : content.length > limit * 0.9 ? 'text-yellow-400' : 'text-[#555]'

  const handleFile = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) return

    const previewUrl = URL.createObjectURL(file)
    setMedia({ file, previewUrl, type: isVideo ? 'video' : 'image' })

    // Auto-upload
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/social/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.key && data.url) {
        setMedia(prev => prev ? { ...prev, uploadedKey: data.key, uploadedUrl: data.url } : null)
      }
    } catch (e) {
      console.error('Upload failed', e)
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const generate = async () => {
    if (!topic) return
    setGenerating(true)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true, platform, topic, count: 1 }),
      })
      const data = await res.json()
      if (data.posts?.[0]) {
        setContent(data.posts[0].content)
        setHashtags((data.posts[0].hashtags || []).join(', '))
      }
    } finally {
      setGenerating(false)
    }
  }

  const save = async (status: 'draft' | 'pending_approval' | 'scheduled') => {
    setSaving(true)
    try {
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          content,
          hashtags: hashtags.split(',').map(h => h.trim().replace('#', '')).filter(Boolean),
          status,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          mediaKey: media?.uploadedKey,
          mediaUrl: media?.uploadedUrl,
        }),
      })
      onSaved()
      onClose()
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setContent('')
    setHashtags('')
    setScheduledAt('')
    setTopic('')
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl)
    setMedia(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Platform preview card
  const hashtagList = hashtags.split(',').map(h => h.trim()).filter(Boolean).map(h => h.startsWith('#') ? h : `#${h}`)
  const previewText = content + (hashtagList.length ? '\n\n' + hashtagList.join(' ') : '')

  return (
    <Modal open={open} onClose={handleClose} title="New Post" size="xl">
      <div className="flex gap-0 h-[600px]">
        {/* Left: Compose */}
        <div className="flex-1 p-5 space-y-4 overflow-y-auto border-r border-[#1E1E1E]">
          {/* Platform selector */}
          <div className="flex gap-2">
            {(['linkedin', 'facebook', 'instagram'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  platform === p
                    ? 'text-white'
                    : 'bg-[#1A1A1A] text-[#A0A0A0] hover:text-white border border-[#2A2A2A]'
                }`}
                style={platform === p ? { backgroundColor: PLATFORM_COLORS[p] } : {}}
              >
                {p}
              </button>
            ))}
          </div>

          {/* AI generate */}
          <div className="flex gap-2">
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="Topic (e.g. product launch, industry insight)"
              className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/50"
            />
            <Button size="sm" variant="secondary" onClick={generate} loading={generating}>
              AI Generate
            </Button>
          </div>

          {/* Media upload */}
          <div>
            <label className="text-xs text-[#555] block mb-2">Media (optional)</label>
            {!media ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-[#DA7756] bg-[#DA7756]/5' : 'border-[#2A2A2A] hover:border-[#3A3A3A]'
                }`}
              >
                <svg className="w-8 h-8 mx-auto mb-2 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-[#555]">Drag & drop or <span className="text-[#DA7756]">click to upload</span></p>
                <p className="text-[10px] text-[#333] mt-1">JPG, PNG, GIF, MP4, MOV</p>
              </div>
            ) : (
              <div className="relative bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl overflow-hidden">
                {media.type === 'image' ? (
                  <img src={media.previewUrl} alt="preview" className="w-full max-h-40 object-cover" />
                ) : (
                  <video src={media.previewUrl} controls className="w-full max-h-40" />
                )}
                <div className="flex items-center justify-between px-3 py-2 border-t border-[#1E1E1E]">
                  <div className="flex items-center gap-2 min-w-0">
                    {uploading ? (
                      <span className="text-xs text-[#DA7756]">Uploading…</span>
                    ) : media.uploadedKey ? (
                      <span className="text-xs text-green-400">✓ Uploaded</span>
                    ) : (
                      <span className="text-xs text-yellow-400">Pending upload</span>
                    )}
                    <span className="text-[10px] text-[#555] truncate">{media.file.name}</span>
                    <span className="text-[10px] text-[#333] shrink-0">{formatBytes(media.file.size)}</span>
                  </div>
                  <button
                    onClick={() => { URL.revokeObjectURL(media.previewUrl); setMedia(null) }}
                    className="text-[#555] hover:text-red-400 transition-colors ml-2 shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
            />
          </div>

          {/* Content textarea with char counter */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-[#555]">Caption</label>
              <span className={`text-xs ${charColor}`}>
                {content.length.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={7}
              placeholder="Write your post…"
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-white placeholder-[#555] outline-none focus:border-[#DA7756]/50 resize-none"
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="text-xs text-[#555] block mb-1">Hashtags (comma separated)</label>
            <input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#marketing, #growth, #startup"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-[#DA7756] placeholder-[#555] outline-none focus:border-[#DA7756]/50"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="text-xs text-[#555] block mb-1">Schedule (optional)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#DA7756]/50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-[#1E1E1E]">
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button variant="secondary" size="sm" onClick={() => save('draft')} loading={saving}>Save Draft</Button>
            {scheduledAt && (
              <Button variant="secondary" size="sm" onClick={() => save('scheduled')} loading={saving}>Schedule</Button>
            )}
            <Button size="sm" onClick={() => save('pending_approval')} loading={saving} disabled={!content.trim()}>
              Add to Queue
            </Button>
          </div>
        </div>

        {/* Right: Platform preview */}
        <div className="w-72 shrink-0 p-5 flex flex-col gap-3">
          <p className="text-xs text-[#555] font-medium uppercase tracking-wider">Preview</p>

          <div className="bg-[#0D0D0D] border border-[#1E1E1E] rounded-xl overflow-hidden">
            {/* Platform header */}
            <div className="px-3 py-2.5 border-b border-[#1A1A1A] flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: PLATFORM_COLORS[platform] }}
              >
                {platform[0].toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-white">{brandName}</p>
                <p className="text-[10px] text-[#555]">Just now · {platform}</p>
              </div>
            </div>

            {/* Media preview */}
            {media && (
              <div className="bg-[#111]">
                {media.type === 'image' ? (
                  <img src={media.previewUrl} alt="preview" className="w-full max-h-36 object-cover" />
                ) : (
                  <video src={media.previewUrl} className="w-full max-h-36 object-cover" muted />
                )}
              </div>
            )}

            {/* Content */}
            <div className="px-3 py-2.5">
              {content ? (
                <p className="text-xs text-[#A0A0A0] whitespace-pre-wrap line-clamp-6 leading-relaxed">{previewText}</p>
              ) : (
                <p className="text-xs text-[#333] italic">Your caption will appear here…</p>
              )}
            </div>

            {/* Engagement row */}
            <div className="px-3 py-2 border-t border-[#1A1A1A] flex gap-4">
              {['👍 Like', '💬 Comment', '↗ Share'].map(a => (
                <span key={a} className="text-[10px] text-[#333]">{a}</span>
              ))}
            </div>
          </div>

          {/* Platform tips */}
          <div className="text-[10px] text-[#444] space-y-1 mt-1">
            {platform === 'linkedin' && (
              <>
                <p>• Best time: Tue–Thu 8–10 AM</p>
                <p>• Use 3–5 hashtags</p>
                <p>• First 150 chars shown before &quot;…more&quot;</p>
              </>
            )}
            {platform === 'facebook' && (
              <>
                <p>• Best time: Wed 11 AM–1 PM</p>
                <p>• Questions drive comments</p>
                <p>• Images get 2.3x more engagement</p>
              </>
            )}
            {platform === 'instagram' && (
              <>
                <p>• Best time: Mon–Fri 9 AM–11 AM</p>
                <p>• Use 5–15 hashtags</p>
                <p>• First 125 chars shown in feed</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
