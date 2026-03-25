import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { normalizeBrandCompetitors } from '@/lib/competitors'
import Brand from '@/models/Brand'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const brand = await Brand.findOne({ userId: session.user.id })
  if (brand?.competitors?.length) {
    const normalized = normalizeBrandCompetitors(brand.competitors)
    if (normalized.length !== brand.competitors.length || JSON.stringify(normalized) !== JSON.stringify(brand.competitors)) {
      brand.competitors = normalized
      await brand.save()
    }
  }
  return Response.json({ brand: brand || {} })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()
  if (body.competitors) {
    body.competitors = normalizeBrandCompetitors(body.competitors)
  }
  const brand = await Brand.findOneAndUpdate(
    { userId: session.user.id },
    body,
    { new: true, upsert: true }
  )
  return Response.json({ brand })
}
