import mongoose, { Schema, Document } from 'mongoose'

export interface ISocialPost extends Document {
  userId: mongoose.Types.ObjectId
  platform: 'linkedin' | 'facebook' | 'instagram'
  content: string
  hashtags?: string[]
  mediaKey?: string
  mediaType?: string
  mediaUrl?: string
  status: 'draft' | 'pending_approval' | 'scheduled' | 'processing' | 'published' | 'failed' | 'failed_auth'
  scheduledAt?: Date
  publishedAt?: Date
  platformPostId?: string   // ID returned by platform API — idempotency key
  retryCount: number
  lastError?: string
  nextRetryAt?: Date
  processingStartedAt?: Date
  createdAt: Date
}

const SocialPostSchema = new Schema<ISocialPost>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['linkedin', 'facebook', 'instagram'], required: true },
  content: { type: String, required: true },
  hashtags: [String],
  mediaKey: String,
  mediaType: String,
  mediaUrl: String,
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'scheduled', 'processing', 'published', 'failed', 'failed_auth'],
    default: 'draft',
  },
  scheduledAt: Date,
  publishedAt: Date,
  platformPostId: String,
  retryCount: { type: Number, default: 0 },
  lastError: String,
  nextRetryAt: Date,
  processingStartedAt: Date,
  createdAt: { type: Date, default: Date.now },
})

// User-facing queries (dashboard, social workspace)
SocialPostSchema.index({ userId: 1, platform: 1, status: 1 })

// Cron: first-attempt posts due by scheduledAt
SocialPostSchema.index({ status: 1, scheduledAt: 1 })

// Cron: retry posts due after backoff
SocialPostSchema.index({ status: 1, nextRetryAt: 1 })

// Cron: stuck-processing detection
SocialPostSchema.index({ status: 1, processingStartedAt: 1 })

export default mongoose.models.SocialPost || mongoose.model<ISocialPost>('SocialPost', SocialPostSchema)
