import mongoose, { Schema, Document } from 'mongoose'

export interface IBlogPost extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  content: string
  excerpt?: string
  metaDescription?: string
  targetKeyword?: string
  tags?: string[]
  status: 'draft' | 'pending_approval' | 'scheduled' | 'published' | 'failed'
  scheduledAt?: Date
  publishedAt?: Date
  seoScore?: number
  wordCount?: number
  createdAt: Date
}

const BlogPostSchema = new Schema<IBlogPost>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  excerpt: String,
  metaDescription: String,
  targetKeyword: String,
  tags: [String],
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'scheduled', 'published', 'failed'],
    default: 'pending_approval',
  },
  scheduledAt: Date,
  publishedAt: Date,
  seoScore: Number,
  wordCount: Number,
  createdAt: { type: Date, default: Date.now },
})

BlogPostSchema.index({ userId: 1, status: 1 })
BlogPostSchema.index({ userId: 1, scheduledAt: 1 })

export default mongoose.models.BlogPost || mongoose.model<IBlogPost>('BlogPost', BlogPostSchema)
