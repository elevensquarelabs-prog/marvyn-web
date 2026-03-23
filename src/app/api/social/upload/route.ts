import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadToWasabi, getPresignedUrl } from '@/lib/wasabi'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'bin'
  const key = `social/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  await uploadToWasabi(key, buffer, file.type)
  const url = await getPresignedUrl(key, 86400)

  return Response.json({ key, url, mediaType: file.type.startsWith('video/') ? 'video' : 'image' })
}
