import mongoose, { Schema, Document } from 'mongoose'

export interface IStrategyTask {
  title: string
  done: boolean
  sourcePriority?: string
  blockedByPriority?: string[]
}

export interface IStrategyPulse {
  day: number
  capturedAt: Date
  onTrack: string[]
  behind: string[]
  blocked: string[]
  signalDrift: string | null
  todaysFocus: string
  snapshot: IStrategyPerformanceSnapshot
}

export interface IStrategyPriority {
  title: string
  reason: string
  actions: string[]
}

export interface IStrategyChannel {
  channel: string
  platformRole?: string
  focus: string
  kpi: string
  cadence?: string
  outputTarget?: string
  effort?: 'low' | 'medium' | 'high'
  executionNote?: string
}

export interface IStrategyMetric {
  label: string
  target: string
}

export interface IStrategyQuestionAnswer {
  key: string
  question: string
  answer: string
}

export interface IStrategyDiagnosis {
  bottleneck: string
  positioningRisk: string
  channelThesis: string[]
  executionConstraints: string[]
}

export interface IStrategyReview {
  actualSignal?: string
  summary?: string
  executionSummary?: string
  signalChanges?: string[]
  whatWorked: string[]
  whatFailed: string[]
  nextCycleFocus: string[]
}

export interface IStrategyPerformanceSnapshot {
  capturedAt?: Date
  ga4Sessions?: number
  ga4Users?: number
  ga4Conversions?: number
  ga4BounceRate?: number
  organicClicks?: number
  paidSpend?: number
  paidClicks?: number
  paidConversions?: number
  paidRoas?: number | null
  paidCtr?: number
  blogCount?: number
  socialCount?: number
  completedTasks?: number
  totalTasks?: number
}

export interface IStrategyPlan extends Document {
  userId: mongoose.Types.ObjectId
  businessModel?: 'd2c_ecommerce' | 'saas' | 'services_lead_gen'
  primaryGoal?: string
  primaryConversion?: string
  primaryChannels?: string[]
  questionAnswers?: IStrategyQuestionAnswer[]
  diagnosis?: IStrategyDiagnosis
  summary: string
  northStarMetric: string
  successMetric?: IStrategyMetric
  priorities: IStrategyPriority[]
  channelPlan: IStrategyChannel[]
  contentIdeas: string[]
  risks: string[]
  tasks: IStrategyTask[]
  priorityDependencies?: Record<string, string[]>
  pulses?: IStrategyPulse[]
  customAdjustments?: string
  manualNotes?: string
  manualWins?: string
  review?: IStrategyReview
  baselineSnapshot?: IStrategyPerformanceSnapshot
  actualSnapshot?: IStrategyPerformanceSnapshot
  generationState?: 'idle' | 'running' | 'failed'
  generationError?: string
  status: 'draft' | 'active' | 'completed'
  startDate?: Date
  endDate?: Date
  committedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const StrategyPlanSchema = new Schema<IStrategyPlan>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessModel: { type: String, enum: ['d2c_ecommerce', 'saas', 'services_lead_gen'] },
  primaryGoal: String,
  primaryConversion: String,
  primaryChannels: [String],
  questionAnswers: [{
    key: String,
    question: String,
    answer: String,
  }],
  diagnosis: {
    bottleneck: String,
    positioningRisk: String,
    channelThesis: [String],
    executionConstraints: [String],
  },
  summary: { type: String, required: true },
  northStarMetric: { type: String, required: true },
  successMetric: {
    label: String,
    target: String,
  },
  priorities: [{
    title: String,
    reason: String,
    actions: [String],
  }],
  channelPlan: [{
    channel: String,
    platformRole: String,
    focus: String,
    kpi: String,
    cadence: String,
    outputTarget: String,
    effort: { type: String, enum: ['low', 'medium', 'high'] },
    executionNote: String,
  }],
  contentIdeas: [String],
  risks: [String],
  tasks: [{
    title: String,
    done: { type: Boolean, default: false },
    sourcePriority: String,
    blockedByPriority: [String],
  }],
  priorityDependencies: { type: Schema.Types.Mixed, default: {} },
  pulses: [{
    day: Number,
    capturedAt: Date,
    onTrack: [String],
    behind: [String],
    blocked: [String],
    signalDrift: String,
    todaysFocus: String,
    snapshot: {
      capturedAt: Date,
      ga4Sessions: Number,
      ga4Users: Number,
      ga4Conversions: Number,
      ga4BounceRate: Number,
      organicClicks: Number,
      paidSpend: Number,
      paidClicks: Number,
      paidConversions: Number,
      paidRoas: Number,
      paidCtr: Number,
      blogCount: Number,
      socialCount: Number,
      completedTasks: Number,
      totalTasks: Number,
    },
  }],
  customAdjustments: String,
  manualNotes: String,
  manualWins: String,
  review: {
    actualSignal: String,
    summary: String,
    executionSummary: String,
    signalChanges: [String],
    whatWorked: [String],
    whatFailed: [String],
    nextCycleFocus: [String],
  },
  baselineSnapshot: {
    capturedAt: Date,
    ga4Sessions: Number,
    ga4Users: Number,
    ga4Conversions: Number,
    ga4BounceRate: Number,
    organicClicks: Number,
    paidSpend: Number,
    paidClicks: Number,
    paidConversions: Number,
    paidRoas: Number,
    paidCtr: Number,
    blogCount: Number,
    socialCount: Number,
    completedTasks: Number,
    totalTasks: Number,
  },
  actualSnapshot: {
    capturedAt: Date,
    ga4Sessions: Number,
    ga4Users: Number,
    ga4Conversions: Number,
    ga4BounceRate: Number,
    organicClicks: Number,
    paidSpend: Number,
    paidClicks: Number,
    paidConversions: Number,
    paidRoas: Number,
    paidCtr: Number,
    blogCount: Number,
    socialCount: Number,
    completedTasks: Number,
    totalTasks: Number,
  },
  generationState: { type: String, enum: ['idle', 'running', 'failed'], default: 'idle' },
  generationError: String,
  status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft', index: true },
  startDate: Date,
  endDate: Date,
  committedAt: Date,
  completedAt: Date,
}, { timestamps: true })

export default mongoose.models.StrategyPlan || mongoose.model<IStrategyPlan>('StrategyPlan', StrategyPlanSchema)
