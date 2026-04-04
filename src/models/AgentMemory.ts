import mongoose, { Schema, Document } from 'mongoose'

export interface IAgentMemory extends Document {
  userId: string
  agent: 'ads' | 'seo' | 'content' | 'strategist'
  memoryId: string           // UUID — matches RecommendationItem.id
  sessionId: string

  timestamp: string          // ISO 8601

  recommendation: string     // = RecommendationItem.action
  rationale: string
  sourceKeys: string[]
  domainTags: string[]

  goalRequest: string
  timeHorizon?: 'instant' | '7d' | '30d' | 'quarter'
  successCriteria?: string
  constraints?: string[]

  metricSnapshot: Record<string, unknown>

  status: 'open' | 'accepted' | 'rejected' | 'completed'
  outcome?: string
  humanDecision?: string
  followUpAt?: string
}

const AgentMemorySchema = new Schema<IAgentMemory>(
  {
    userId:         { type: String, required: true, index: true },
    agent:          { type: String, required: true, enum: ['ads', 'seo', 'content', 'strategist'] },
    memoryId:       { type: String, required: true, unique: true },
    sessionId:      { type: String, required: true },

    timestamp:      { type: String, required: true },

    recommendation: { type: String, required: true },
    rationale:      { type: String, required: true },
    sourceKeys:     { type: [String], default: [] },
    domainTags:     { type: [String], default: [], index: true },

    goalRequest:    { type: String, required: true },
    timeHorizon:    { type: String, enum: ['instant', '7d', '30d', 'quarter'] },
    successCriteria: { type: String },
    constraints:    { type: [String] },

    metricSnapshot: { type: Schema.Types.Mixed, default: {} },

    status:         { type: String, required: true, enum: ['open', 'accepted', 'rejected', 'completed'], default: 'open', index: true },
    outcome:        { type: String },
    humanDecision:  { type: String },
    followUpAt:     { type: String, index: true },
  },
  { timestamps: false }
)

// Compound indexes per spec
AgentMemorySchema.index({ userId: 1, agent: 1, status: 1 })
AgentMemorySchema.index({ userId: 1, domainTags: 1 })
AgentMemorySchema.index({ userId: 1, followUpAt: 1 })

export default mongoose.models.AgentMemory as mongoose.Model<IAgentMemory> ||
  mongoose.model<IAgentMemory>('AgentMemory', AgentMemorySchema)
