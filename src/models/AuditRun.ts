import mongoose, { Schema } from 'mongoose'

const AuditRunSchema = new Schema({
  userId: { type: String, required: true, index: true },
  domain: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
})

export default mongoose.models.AuditRun || mongoose.model('AuditRun', AuditRunSchema)
