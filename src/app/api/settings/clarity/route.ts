import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { getUserConnections } from '@/lib/get-user-connections'
import { fetchClarityData } from '@/lib/clarity'
import mongoose from 'mongoose'

export async function GET() {
  try {
    const { userId } = await getUserConnections()
    console.log('[Clarity] GET called, userId:', userId)

    await connectDB()
    // Use raw MongoDB driver to bypass Mongoose schema cache issues
    const doc = await mongoose.connection.db!
      .collection('users')
      .findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { 'connections.clarity': 1 } }
      )

    const clarity = (doc as { connections?: { clarity?: { projectId?: string; apiToken?: string; connectedAt?: Date } } } | null)?.connections?.clarity
    console.log('[Clarity] clarity from DB:', JSON.stringify(clarity))

    return Response.json({
      connected: !!(clarity?.projectId && clarity?.apiToken),
      projectId: clarity?.projectId ?? null,
      connectedAt: clarity?.connectedAt ?? null,
    })
  } catch (e) {
    console.log('[Clarity] GET error:', e)
    return Response.json({ connected: false, projectId: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('[Clarity] POST called')
    const { userId } = await getUserConnections()
    console.log('[Clarity] userId:', userId)

    const { projectId, apiToken } = await req.json()
    console.log('[Clarity] body:', { projectId, hasToken: !!apiToken })

    if (!projectId || !apiToken) {
      return Response.json({ error: 'projectId and apiToken are required' }, { status: 400 })
    }

    // Validate credentials against live API
    try {
      await fetchClarityData(projectId, apiToken, 1, 'Device')
      console.log('[Clarity] API validation passed')
    } catch (e) {
      console.log('[Clarity] API validation failed:', e)
      return Response.json(
        { error: 'Invalid credentials — could not reach Clarity API. Check your Project ID and API token.' },
        { status: 400 }
      )
    }

    await connectDB()
    // Use raw MongoDB driver — bypasses Mongoose strict-mode schema cache
    const result = await mongoose.connection.db!
      .collection('users')
      .findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            'connections.clarity.projectId': projectId,
            'connections.clarity.apiToken': apiToken,
            'connections.clarity.connectedAt': new Date(),
          },
        },
        { returnDocument: 'after', projection: { 'connections.clarity': 1 } }
      )

    const savedClarity = (result as { connections?: { clarity?: unknown } } | null)?.connections?.clarity
    console.log('[Clarity] Saved to DB:', JSON.stringify(savedClarity))

    return Response.json({ success: true })
  } catch (e) {
    console.log('[Clarity] POST error:', e)
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { userId } = await getUserConnections()
    await connectDB()
    await mongoose.connection.db!
      .collection('users')
      .updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $unset: { 'connections.clarity': '' } }
      )
    console.log('[Clarity] Disconnected for user:', userId)
    return Response.json({ success: true })
  } catch (e) {
    console.log('[Clarity] DELETE error:', e)
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
