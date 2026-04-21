import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPublicUrl, uploadToWasabi } from '@/lib/wasabi'

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'video/quicktime',
])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    return Response.json({ error: 'Unsupported media type' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'bin'
  const key = `social/${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  await uploadToWasabi(key, buffer, file.type)
  const url = getPublicUrl(key)

  return Response.json({ key, url, mediaType: file.type.startsWith('video/') ? 'video' : 'image' })
}
