import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { newPassword } = await req.json()
  if (!newPassword || newPassword.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  await connectDB()
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await User.findByIdAndUpdate(session.user.id, {
    password: hashedPassword,
    mustResetPassword: false,
  })

  return Response.json({ success: true })
}
