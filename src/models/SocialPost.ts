import mongoose, { Schema, Document } from 'mongoose'

export interface ISocialPost extends Document {
  userId: mongoose.Types.ObjectId
  platform: 'linkedin' | 'facebook' | 'instagram'
  content: string
  hashtags?: string[]
  mediaKey?: string
  mediaType?: string
  mediaUrl?: string
  status: 'draft' | 'pending_approval' | 'scheduled' | 'published' | 'failed'
  scheduledAt?: Date
  publishedAt?: Date
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
    enum: ['draft', 'pending_approval', 'scheduled', 'published', 'failed'],
    default: 'draft',
  },
  scheduledAt: Date,
  publishedAt: Date,
  createdAt: { type: Date, default: Date.now },
})

SocialPostSchema.index({ userId: 1, platform: 1, status: 1 })
SocialPostSchema.index({ status: 1, scheduledAt: 1 })

export default mongoose.models.SocialPost || mongoose.model<ISocialPost>('SocialPost', SocialPostSchema)
