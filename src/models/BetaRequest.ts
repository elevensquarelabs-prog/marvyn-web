import mongoose, { Schema, Document } from 'mongoose'

export interface IBetaRequest extends Document {
  name: string
  email: string
  company: string
  teamSize: string
  useCase: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

const BetaRequestSchema = new Schema<IBetaRequest>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, trim: true, lowercase: true },
    company:  { type: String, required: true, trim: true },
    teamSize: { type: String, default: '' },
    useCase:  { type: String, default: '' },
    status:   { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
)

BetaRequestSchema.index({ email: 1 }, { unique: true })

export default mongoose.models.BetaRequest ||
  mongoose.model<IBetaRequest>('BetaRequest', BetaRequestSchema)
