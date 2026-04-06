import mongoose, { Schema, Document } from 'mongoose'
import type { AdminRole } from '@/lib/admin-auth'

export type { AdminRole }

export interface IAdminUser extends Document {
  email: string
  name: string
  password: string   // bcrypt hashed
  role: AdminRole
  isActive: boolean
  createdBy?: mongoose.Types.ObjectId
  lastLoginAt?: Date
  createdAt: Date
}

const AdminUserSchema = new Schema<IAdminUser>({
  email: { type: String, unique: true, required: true, lowercase: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super_admin', 'support', 'billing_viewer'], required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.AdminUser || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema)
