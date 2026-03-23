import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  subscription: {
    status: 'trial' | 'active' | 'cancelled' | 'expired'
    trialEndsAt: Date
    razorpayCustomerId?: string
    razorpaySubscriptionId?: string
    currentPeriodEnd?: Date
    plan?: 'monthly' | 'yearly'
  }
  connections: {
    meta?: { accessToken?: string; accountId?: string; accountName?: string }
    google?: { accessToken?: string; refreshToken?: string; customerId?: string }
    searchConsole?: { accessToken?: string; refreshToken?: string; siteUrl?: string }
    linkedin?: { accessToken?: string; profileId?: string; profileName?: string }
    facebook?: { accessToken?: string; pageId?: string; pageName?: string; pageAccessToken?: string }
    instagram?: { accountId?: string }
    clarity?: { projectId?: string; apiToken?: string; connectedAt?: Date }
  }
  usage: {
    tokensUsedThisMonth: number
    lastResetAt?: Date
  }
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  subscription: {
    status: { type: String, enum: ['trial', 'active', 'cancelled', 'expired'], default: 'trial' },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    razorpayCustomerId: String,
    razorpaySubscriptionId: String,
    currentPeriodEnd: Date,
    plan: { type: String, enum: ['monthly', 'yearly'] },
  },
  connections: {
    meta: { accessToken: String, accountId: String, accountName: String },
    google: { accessToken: String, refreshToken: String, customerId: String },
    searchConsole: { accessToken: String, refreshToken: String, siteUrl: String },
    linkedin: { accessToken: String, profileId: String, profileName: String },
    facebook: { accessToken: String, pageId: String, pageName: String, pageAccessToken: String },
    instagram: { accountId: String },
    clarity: { projectId: String, apiToken: String, connectedAt: Date },
  },
  usage: {
    tokensUsedThisMonth: { type: Number, default: 0 },
    lastResetAt: Date,
  },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
