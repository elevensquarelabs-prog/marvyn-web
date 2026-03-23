import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: mongoose.Schema.Types.Mixed
  createdAt: Date
}

export interface IChatSession extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  messages: IMessage[]
  createdAt: Date
  updatedAt: Date
}

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Chat' },
    messages: [{
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      toolCalls: Schema.Types.Mixed,
      createdAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
)

ChatSessionSchema.index({ userId: 1, updatedAt: -1 })

export default mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', ChatSessionSchema)
