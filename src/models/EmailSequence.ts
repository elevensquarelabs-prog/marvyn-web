import mongoose, { Schema, Document } from 'mongoose'

export interface IEmailStep {
  subject: string
  preview: string
  body: string
  day: number
}

export interface IEmailSequence extends Document {
  userId: string
  name: string
  goal: string
  product: string
  audience: string
  emailCount: number
  steps: IEmailStep[]
  createdAt: Date
  updatedAt: Date
}

const EmailStepSchema = new Schema<IEmailStep>({
  subject: String,
  preview: String,
  body: String,
  day: Number,
})

const EmailSequenceSchema = new Schema<IEmailSequence>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    goal: { type: String, default: 'welcome' },
    product: String,
    audience: String,
    emailCount: Number,
    steps: [EmailStepSchema],
  },
  { timestamps: true }
)

export default mongoose.models.EmailSequence ||
  mongoose.model<IEmailSequence>('EmailSequence', EmailSequenceSchema)
