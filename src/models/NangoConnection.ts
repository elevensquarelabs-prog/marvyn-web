import mongoose, { Schema, Document } from 'mongoose'

export type NangoIntegration = 'shopify' | 'hubspot' | 'stripe'

export interface INangoConnection extends Document {
  userId: mongoose.Types.ObjectId
  integration: NangoIntegration
  connectionId: string
  metadata: {
    shopDomain?: string
    portalId?: string
    accountName?: string
  }
  status: 'active' | 'error'
  connectedAt: Date
  updatedAt: Date
}

const NangoConnectionSchema = new Schema<INangoConnection>({
  userId:       { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  integration:  { type: String, enum: ['shopify', 'hubspot', 'stripe'], required: true },
  connectionId: { type: String, required: true },
  metadata: {
    shopDomain:  String,
    portalId:    String,
    accountName: String,
  },
  status:      { type: String, enum: ['active', 'error'], default: 'active' },
  connectedAt: { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
})

NangoConnectionSchema.index({ userId: 1, integration: 1 }, { unique: true })

export default mongoose.models.NangoConnection ||
  mongoose.model<INangoConnection>('NangoConnection', NangoConnectionSchema)
