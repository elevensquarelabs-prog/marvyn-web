import mongoose, { Schema, Document } from 'mongoose'

export interface IBusinessSnapshot extends Document {
  userId: mongoose.Types.ObjectId
  weekStart: Date   // Monday 00:00 UTC
  weekEnd: Date     // Sunday 23:59 UTC
  metrics: {
    gsc?: { clicks: number; impressions: number; avgPosition: number }
    metaAds?: { spend: number; cpl: number; roas: number; ctr: number; campaigns: number }
    googleAds?: { spend: number; cpl: number; roas: number; conversions: number }
    shopify?: { revenue: number; orderCount: number; aov: number; repeatRate: number; abandonmentRate: number; discountedOrderShare: number }
    ga4?: { sessions: number; conversions: number; bounceRate: number }
  }
  createdAt: Date
}

const BusinessSnapshotSchema = new Schema<IBusinessSnapshot>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  metrics: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
})

// One snapshot per user per week
BusinessSnapshotSchema.index({ userId: 1, weekStart: -1 }, { unique: true })
// Auto-delete after 12 weeks — only need recent history for pattern detection
BusinessSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 84 * 24 * 60 * 60 })

export default mongoose.models.BusinessSnapshot ||
  mongoose.model<IBusinessSnapshot>('BusinessSnapshot', BusinessSnapshotSchema)
