import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  subscription: {
    status: 'trial' | 'active' | 'cancelled' | 'expired' | 'revoked'
    trialEndsAt: Date
    razorpayCustomerId?: string
    razorpaySubscriptionId?: string
    currentPeriodEnd?: Date
    plan?: 'starter' | 'pro' | 'monthly' | 'yearly' | 'beta'
  }
  connections: {
    meta?: { accessToken?: string; accountId?: string; accountName?: string }
    google?: { accessToken?: string; refreshToken?: string; customerId?: string }
    searchConsole?: { accessToken?: string; refreshToken?: string; siteUrl?: string }
    ga4?: { accessToken?: string; refreshToken?: string; propertyId?: string; propertyName?: string; accountName?: string; connectedAt?: Date }
    linkedin?: { accessToken?: string; profileId?: string; profileName?: string; pageId?: string; pageName?: string; adAccountId?: string; adAccountName?: string }
    facebook?: { accessToken?: string; pageId?: string; pageName?: string; pageAccessToken?: string }
    instagram?: { accountId?: string }
    clarity?: { projectId?: string; apiToken?: string; connectedAt?: Date }
  }
  usage: {
    tokensUsedThisMonth: number
    monthlyCredits?: number
    creditsUsedThisMonth?: number
    extraCreditsBalance?: number
    estimatedCostUsdThisMonth?: number
    lastResetAt?: Date
    lastCreditsResetAt?: Date
    totalAiCalls?: number
    lastActive?: Date
    blogPostsGenerated?: number
    socialPostsGenerated?: number
    emailsGenerated?: number
    copyAssetsGenerated?: number
  }
  timezone: string
  alertPreferences: {
    weeklyDigest: boolean
    trafficDrop: boolean
    contentGap: boolean
    frequency: 'daily' | 'weekly' | 'manual'
    preferredDay: number   // 0=Sun, 1=Mon … 6=Sat
    preferredHour: number  // 0–23 in user's local time
  }
  mustResetPassword?: boolean
  emailVerified?: Date
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  subscription: {
    status: { type: String, enum: ['trial', 'active', 'cancelled', 'expired', 'revoked'], default: 'trial' },
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    razorpayCustomerId: String,
    razorpaySubscriptionId: String,
    currentPeriodEnd: Date,
    plan: { type: String, enum: ['starter', 'pro', 'monthly', 'yearly', 'beta'] },
  },
  connections: {
    meta: { accessToken: String, accountId: String, accountName: String },
    google: { accessToken: String, refreshToken: String, customerId: String },
    searchConsole: { accessToken: String, refreshToken: String, siteUrl: String },
    ga4: { accessToken: String, refreshToken: String, propertyId: String, propertyName: String, accountName: String, connectedAt: Date },
    linkedin: { accessToken: String, profileId: String, profileName: String, pageId: String, pageName: String, adAccountId: String, adAccountName: String },
    facebook: { accessToken: String, pageId: String, pageName: String, pageAccessToken: String },
    instagram: { accountId: String, username: String },
    clarity: { projectId: String, apiToken: String, connectedAt: Date },
  },
  usage: {
    tokensUsedThisMonth: { type: Number, default: 0 },
    monthlyCredits: { type: Number, default: 150 },
    creditsUsedThisMonth: { type: Number, default: 0 },
    extraCreditsBalance: { type: Number, default: 0 },
    estimatedCostUsdThisMonth: { type: Number, default: 0 },
    lastResetAt: Date,
    lastCreditsResetAt: Date,
    totalAiCalls: { type: Number, default: 0 },
    lastActive: Date,
    blogPostsGenerated: { type: Number, default: 0 },
    socialPostsGenerated: { type: Number, default: 0 },
    emailsGenerated: { type: Number, default: 0 },
    copyAssetsGenerated: { type: Number, default: 0 },
  },
  timezone: { type: String, default: 'UTC' },
  alertPreferences: {
    weeklyDigest: { type: Boolean, default: true },
    trafficDrop: { type: Boolean, default: true },
    contentGap: { type: Boolean, default: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'manual'], default: 'weekly' },
    preferredDay: { type: Number, default: 1 },
    preferredHour: { type: Number, default: 9 },
  },
  mustResetPassword: { type: Boolean, default: false },
  emailVerified: { type: Date },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
