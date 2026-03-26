import mongoose, { Schema, Document } from 'mongoose'

export interface ICompetitor {
  url: string
  name: string
  positioning?: string
  keywords?: string[]
  status?: string
  analyzedAt?: Date
}

export interface ICompetitorAnalysis {
  analyzedAt: Date
  domain: string
  location: string
  summary: string
  overallScore: number
  competitors: Array<{
    domain: string
    title: string
    description: string
    organicTraffic?: number
    organicKeywords?: number
    domainRank?: number
    mainStrength: string
    weakness: string
  }>
  opportunities: Array<{
    type: string
    description: string
    action: string
  }>
}

export interface IBrand extends Document {
  userId: mongoose.Types.ObjectId
  name: string
  product: string
  audience: string
  businessModel?: 'd2c_ecommerce' | 'saas' | 'services_lead_gen'
  primaryGoal?: string
  primaryConversion?: string
  averageOrderValue?: number
  primaryChannels?: string[]
  tone: string
  usp: string
  avoidWords?: string
  platforms?: string[]
  websiteUrl?: string
  currency: string
  competitors: ICompetitor[]
  competitorAnalysis?: ICompetitorAnalysis
}

const BrandSchema = new Schema<IBrand>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, default: '' },
  product: { type: String, default: '' },
  audience: { type: String, default: '' },
  businessModel: { type: String, enum: ['d2c_ecommerce', 'saas', 'services_lead_gen'] },
  primaryGoal: { type: String, default: '' },
  primaryConversion: { type: String, default: '' },
  averageOrderValue: Number,
  primaryChannels: [String],
  tone: { type: String, default: '' },
  usp: { type: String, default: '' },
  avoidWords: String,
  platforms: [String],
  websiteUrl: String,
  currency: { type: String, default: 'INR' },
  competitors: [{
    url: String,
    name: String,
    positioning: String,
    keywords: [String],
    status: String,
    analyzedAt: Date,
  }],
  competitorAnalysis: {
    analyzedAt: Date,
    domain: String,
    location: String,
    summary: String,
    overallScore: Number,
    competitors: [{ domain: String, title: String, description: String, organicTraffic: Number, organicKeywords: Number, domainRank: Number, mainStrength: String, weakness: String }],
    opportunities: [{ type: String, description: String, action: String }],
  },
})

export default mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema)
