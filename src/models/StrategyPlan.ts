import mongoose, { Schema, Document } from 'mongoose'

export interface IStrategyTask {
  title: string
  done: boolean
  sourcePriority?: string
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
  whatWorked: string[]
  whatFailed: string[]
  nextCycleFocus: string[]
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
  customAdjustments?: string
  manualNotes?: string
  manualWins?: string
  review?: IStrategyReview
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
  }],
  customAdjustments: String,
  manualNotes: String,
  manualWins: String,
  review: {
    actualSignal: String,
    summary: String,
    whatWorked: [String],
    whatFailed: [String],
    nextCycleFocus: [String],
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
