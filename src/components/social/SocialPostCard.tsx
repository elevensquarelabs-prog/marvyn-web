'use client'

import { Badge } from '@/components/shared/Badge'
import { Button } from '@/components/shared/Button'

interface SocialPost {
  _id: string
  platform: string
  content: string
  hashtags?: string[]
  status: string
  scheduledAt?: string
  mediaUrl?: string
}

const platformIcon: Record<string, string> = {
  linkedin: 'in',
  facebook: 'f',
  instagram: 'ig',
}

const platformColor: Record<string, string> = {
  linkedin: 'bg-blue-900/30 text-blue-400',
  facebook: 'bg-indigo-900/30 text-indigo-400',
  instagram: 'bg-pink-900/30 text-pink-400',
}

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'default'> = {
  pending_approval: 'warning',
  scheduled: 'info',
  published: 'success',
  failed: 'danger',
  draft: 'default',
}

export function SocialPostCard({
  post,
  onClick,
  onPublish,
}: {
  post: SocialPost
  onClick: () => void
  onPublish?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="p-3 bg-[#111] border border-[#1E1E1E] rounded-lg cursor-pointer hover:border-[#2E2E2E] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${platformColor[post.platform] || 'bg-[#1E1E1E] text-[#A0A0A0]'}`}>
            {platformIcon[post.platform] || post.platform}
          </span>
          <Badge variant={statusVariant[post.status] || 'default'}>
            {post.status.replace('_', ' ')}
          </Badge>
        </div>
        {onPublish && post.status === 'pending_approval' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={e => { e.stopPropagation(); onPublish() }}
            className="text-xs"
          >
            Publish
          </Button>
        )}
      </div>
      <p className="text-sm text-[var(--text-primary)] line-clamp-3 leading-relaxed">{post.content}</p>
      {post.hashtags && post.hashtags.length > 0 && (
        <p className="text-xs text-[#DA7756] mt-1 truncate">
          {post.hashtags.map(h => `#${h}`).join(' ')}
        </p>
      )}
      {post.scheduledAt && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          📅 {new Date(post.scheduledAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
