import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { llm } from '@/lib/llm'
import Brand from '@/models/Brand'
import axios from 'axios'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { url, analyze } = await req.json()

  const brand = await Brand.findOne({ userId: session.user.id })
  if (!brand) return Response.json({ error: 'Brand not found' }, { status: 404 })

  const competitor = { url, name: new URL(url).hostname, status: 'pending', analyzedAt: new Date() }

  if (analyze) {
    try {
      const prompt = `Analyze this competitor website: ${url}

Based on the URL and domain, provide a competitive analysis in JSON:
{
  "name": "Company Name",
  "positioning": "Their main value proposition and market position",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "status": "analyzed"
}
Only return valid JSON.`

      const raw = await llm(prompt, 'You are a competitive intelligence analyst.', 'medium')
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        Object.assign(competitor, data)
      }
    } catch (e) {
      console.error('[competitors]', e)
    }
  }

  await Brand.findOneAndUpdate(
    { userId: session.user.id },
    { $push: { competitors: competitor } }
  )

  return Response.json({ competitor }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { url } = await req.json()
  await Brand.findOneAndUpdate(
    { userId: session.user.id },
    { $pull: { competitors: { url } } }
  )
  return Response.json({ success: true })
}
