import mongoose, { Schema, Document } from 'mongoose'

export interface IKeyword extends Document {
  userId: mongoose.Types.ObjectId
  keyword: string
  source?: string
  searchVolume?: number
  difficulty?: number
  currentPosition?: number
  clicks?: number
  impressions?: number
  ctr?: number
  status: 'unassigned' | 'targeting' | 'ranking' | 'won'
  createdAt: Date
}

const KeywordSchema = new Schema<IKeyword>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  keyword: { type: String, required: true },
  source: String,
  searchVolume: Number,
  difficulty: Number,
  currentPosition: Number,
  clicks: Number,
  impressions: Number,
  ctr: Number,
  status: {
    type: String,
    enum: ['unassigned', 'targeting', 'ranking', 'won'],
    default: 'unassigned',
  },
  createdAt: { type: Date, default: Date.now },
})

KeywordSchema.index({ userId: 1, keyword: 1 }, { unique: true })

export default mongoose.models.Keyword || mongoose.model<IKeyword>('Keyword', KeywordSchema)
