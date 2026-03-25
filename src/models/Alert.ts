import mongoose, { Schema, Document } from 'mongoose'

export type AlertType = 'weekly_digest' | 'traffic_drop' | 'content_gap' | 'budget_alert'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface IAlert extends Document {
  userId: mongoose.Types.ObjectId
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  data?: Record<string, unknown>
  dedupeKey?: string   // prevents duplicate alerts: "{userId}:{type}:{period}"
  read: boolean
  dismissed: boolean
  createdAt: Date
  expiresAt?: Date
}

const AlertSchema = new Schema<IAlert>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['weekly_digest', 'traffic_drop', 'content_gap', 'budget_alert'],
    required: true,
  },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed },
  dedupeKey: String,
  read: { type: Boolean, default: false },
  dismissed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date,
})

// User's active alert feed (main query)
AlertSchema.index({ userId: 1, dismissed: 1, createdAt: -1 })
// Dedup check: most recent alert of a given type for a user
AlertSchema.index({ userId: 1, type: 1, createdAt: -1 })
// Atomic dedup: one alert per userId+type+period
AlertSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true })
// Auto-delete after 90 days
AlertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export default mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema)
