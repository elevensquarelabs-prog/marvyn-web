'use client'

import { Badge } from '@/components/shared/Badge'

interface Post {
  _id: string
  title: string
  status: string
  targetKeyword?: string
  wordCount?: number
  seoScore?: number
  scheduledAt?: string
  createdAt: string
}

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'default'> = {
  pending_approval: 'warning',
  scheduled: 'info',
  published: 'success',
  failed: 'danger',
  draft: 'default',
}

const statusLabel: Record<string, string> = {
  pending_approval: 'Pending',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
  draft: 'Draft',
}

export function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--text-muted)] transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 group-hover:text-[#DA7756] transition-colors">
          {post.title}
        </h4>
        <Badge variant={statusVariant[post.status] || 'default'} className="shrink-0">
          {statusLabel[post.status] || post.status}
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
        {post.targetKeyword && <span>🎯 {post.targetKeyword}</span>}
        {post.wordCount && <span>{post.wordCount}w</span>}
        {post.seoScore && (
          <span className={post.seoScore >= 80 ? 'text-green-500' : post.seoScore >= 60 ? 'text-yellow-500' : 'text-red-500'}>
            SEO {post.seoScore}
          </span>
        )}
        {post.scheduledAt && (
          <span>📅 {new Date(post.scheduledAt).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  )
}
