import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { sendTempPasswordEmail } from '@/lib/email'

const SUPER_ADMIN_EMAIL = 'raayed32@gmail.com'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user?.email !== SUPER_ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
