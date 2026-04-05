import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendTempPasswordEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try { await requireAdmin(req, 'support') } catch (r) { return r as Response }

  await connectDB()
  const { userId } = await req.json()

  const user = await User.findById(userId).select('email name')
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const temporaryPassword = randomBytes(8).toString('hex')
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

  await User.findByIdAndUpdate(userId, {
    password: hashedPassword,
    mustResetPassword: true,
  })

  console.log(`[admin/reset-password] Reset password for ${user.email}`)
  sendTempPasswordEmail(user.email, user.name, temporaryPassword).catch(() => {})

  return Response.json({
    success: true,
    email: user.email,
  })
}
