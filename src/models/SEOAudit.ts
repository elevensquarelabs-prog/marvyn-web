import mongoose, { Schema, Document } from 'mongoose'

export interface IIssue {
  severity: 'critical' | 'warning' | 'info'
  category: 'Technical' | 'On-Page' | 'Performance'
  title: string
  recommendation: string
}

export interface IAuditCompetitor {
  domain: string
  title: string
  url: string
  description: string
  organicTraffic?: number
  organicKeywords?: number
  domainRank?: number
  mainStrength?: string
  weakness?: string
  tag?: 'direct' | 'indirect' | 'unset'
  added?: boolean
}

export interface IPerformance {
  score: number
  accessibility?: number
  bestPractices?: number
  lighthouseSeo?: number
  fcp?: string
  lcp?: string
  cls?: string
  tbt?: string
  mobile: boolean
}

export interface IAuditAction {
  priority: 'critical' | 'high' | 'medium' | 'low'
  effort: 'Low' | 'Medium' | 'High'
  impact: string
  title: string
  instructions: string[]
  type: 'technical' | 'content' | 'keyword' | 'competitor'
  done: boolean
}

export interface IPageKeyword {
  keyword: string
  source: string
  searchVolume?: number
  difficulty?: number
  position?: number
}

export interface ISEOAudit extends Document {
  userId: string
  domain: string
  location: string
  city?: string
  score: number
  criticalCount: number
  warningCount: number
  passedCount: number
  organicTraffic?: number
  organicKeywords?: number
  trafficSource?: 'gsc' | 'estimated'
  pageData: {
    title: string
    h1: string
    description: string
    keywords: string
    onpageScore: number
    headings: string[]
  }
  issues: IIssue[]
  competitors: IAuditCompetitor[]
  performance: IPerformance
  aiActions: IAuditAction[]
  pageKeywords: IPageKeyword[]
  status: 'running' | 'complete' | 'failed'
  createdAt: Date
  completedAt?: Date
}

const SEOAuditSchema = new Schema<ISEOAudit>({
  userId: { type: String, required: true, index: true },
  domain: String,
  location: String,
  city: String,
  score: { type: Number, default: 0 },
  criticalCount: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  passedCount: { type: Number, default: 0 },
  organicTraffic: Number,
  organicKeywords: Number,
  trafficSource: { type: String, enum: ['gsc', 'estimated'] },
  pageData: {
    title: String, h1: String, description: String,
    keywords: String, onpageScore: Number, headings: [String],
  },
  issues: [{ severity: String, category: String, title: String, recommendation: String }],
  competitors: [{
    domain: String, title: String, url: String, description: String,
    organicTraffic: Number, organicKeywords: Number, domainRank: Number,
    mainStrength: String, weakness: String,
    tag: { type: String, default: 'unset' },
    added: { type: Boolean, default: false },
  }],
  performance: {
    score: Number,
    accessibility: Number,
    bestPractices: Number,
    lighthouseSeo: Number,
    fcp: String, lcp: String, cls: String, tbt: String,
    mobile: Boolean,
  },
  aiActions: [{
    priority: String, effort: String, impact: String, title: String,
    instructions: [String], type: String, done: { type: Boolean, default: false },
  }],
  pageKeywords: [{ keyword: String, source: String, searchVolume: Number, difficulty: Number, position: Number }],
  status: { type: String, enum: ['running', 'complete', 'failed'], default: 'running' },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
})

export default mongoose.models.SEOAudit || mongoose.model<ISEOAudit>('SEOAudit', SEOAuditSchema)
