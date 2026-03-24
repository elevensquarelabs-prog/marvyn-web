import mongoose, { Schema } from 'mongoose'

export type TokenType = 'password_reset' | 'email_verification'

const TokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, lowercase: true },
  token: { type: String, required: true, unique: true },
  type: { type: String, enum: ['password_reset', 'email_verification'], required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
})

TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.Token || mongoose.model('Token', TokenSchema)
