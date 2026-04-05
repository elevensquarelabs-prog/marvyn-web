import mongoose, { Schema } from 'mongoose'

export interface IAIUsageEvent {
  userId: mongoose.Types.ObjectId
  feature: 'copy_generate' | 'blog_generate' | 'social_generate' | 'seo_audit' | 'seo_run' | 'agent_chat' | 'competitor_analysis' | 'clarity_insights' | 'competitor_tagging'
  model: string
  provider: 'anthropic' | 'dataforseo' | 'platform'
  operation?: string
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedCostUsd: number
  exchangeRateInr: number
  creditsCharged: number
  status: 'success' | 'blocked' | 'failed'
  createdAt: Date
}

const AIUsageEventSchema = new Schema<IAIUsageEvent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  feature: {
    type: String,
    enum: ['copy_generate', 'blog_generate', 'social_generate', 'seo_audit', 'seo_run', 'agent_chat', 'competitor_analysis', 'clarity_insights', 'competitor_tagging'],
    required: true,
    index: true,
  },
  model: { type: String, required: true, default: 'unknown' },
  provider: { type: String, enum: ['anthropic', 'dataforseo', 'platform'], required: true, default: 'anthropic' },
  operation: { type: String },
  estimatedInputTokens: { type: Number, default: 0 },
  estimatedOutputTokens: { type: Number, default: 0 },
  estimatedCostUsd: { type: Number, default: 0 },
  exchangeRateInr: { type: Number, default: 83.5 },
  creditsCharged: { type: Number, default: 0 },
  status: { type: String, enum: ['success', 'blocked', 'failed'], required: true, default: 'success' },
  createdAt: { type: Date, default: Date.now, index: true },
})

AIUsageEventSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.models.AIUsageEvent || mongoose.model<IAIUsageEvent>('AIUsageEvent', AIUsageEventSchema)
