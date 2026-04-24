import mongoose, { Schema, Document } from 'mongoose'

export interface IMarvynSocialOAuthCode extends Document {
  codeHash: string
  userId: mongoose.Types.ObjectId
  email: string
  name?: string
  redirectUri: string
  expiresAt: Date
  createdAt: Date
}

const MarvynSocialOAuthCodeSchema = new Schema<IMarvynSocialOAuthCode>({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, lowercase: true },
  name: String,
  redirectUri: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  createdAt: { type: Date, default: Date.now },
})

MarvynSocialOAuthCodeSchema.index({ codeHash: 1, redirectUri: 1, expiresAt: 1 })

export default mongoose.models.MarvynSocialOAuthCode ||
  mongoose.model<IMarvynSocialOAuthCode>('MarvynSocialOAuthCode', MarvynSocialOAuthCodeSchema)
