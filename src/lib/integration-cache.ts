import mongoose, { Schema } from 'mongoose'
import { connectDB } from '@/lib/mongodb'
import crypto from 'crypto'

// ── Inline model ──────────────────────────────────────────────────────────────

interface ICacheDoc {
  key:       string
  data:      unknown
  expiresAt: Date
}

const CacheSchema = new Schema<ICacheDoc>({
  key:       { type: String, required: true, index: true, unique: true },
  data:      { type: Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
})

const CacheModel =
  (mongoose.models.IntegrationCache as mongoose.Model<ICacheDoc>) ||
  mongoose.model<ICacheDoc>('IntegrationCache', CacheSchema)

// ── Public helpers ────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function buildCacheKey(
  userId: string,
  integration: string,
  toolName: string,
  params: Record<string, unknown> = {},
): string {
  const paramsHash = crypto
    .createHash('md5')
    .update(JSON.stringify(params))
    .digest('hex')
    .slice(0, 8)
  return `${userId}:${integration}:${toolName}:${paramsHash}`
}

export async function getCachedIntegrationResult(key: string): Promise<unknown | null> {
  await connectDB()
  const doc = await CacheModel.findOne({ key, expiresAt: { $gt: new Date() } }).lean()
  return doc ? doc.data : null
}

export async function setCachedIntegrationResult(
  key: string,
  data: unknown,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  await connectDB()
  await CacheModel.updateOne(
    { key },
    { $set: { data, expiresAt: new Date(Date.now() + ttlMs) } },
    { upsert: true },
  )
}
