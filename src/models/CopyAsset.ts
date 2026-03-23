import mongoose, { Schema, Document } from 'mongoose'

export interface ICopyAsset extends Document {
  userId: string
  name: string
  copyType: string
  framework: string
  product: string
  audience: string
  content: string
  createdAt: Date
  updatedAt: Date
}

const CopyAssetSchema = new Schema<ICopyAsset>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    copyType: { type: String, default: 'landing' },
    framework: { type: String, default: 'aida' },
    product: String,
    audience: String,
    content: String,
  },
  { timestamps: true }
)

export default mongoose.models.CopyAsset ||
  mongoose.model<ICopyAsset>('CopyAsset', CopyAssetSchema)
