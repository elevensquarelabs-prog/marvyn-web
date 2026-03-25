import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

async function getLinkedinToken(userId: string) {
  await connectDB()
  const doc = await mongoose.connection.db!.collection('users').findOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    { projection: { 'connections.linkedin.accessToken': 1 } }
  )
  return (doc as { connections?: { linkedin?: { accessToken?: string } } } | null)
    ?.connections?.linkedin?.accessToken
}

// GET — fetch LinkedIn pages (organizations) the user manages
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessToken = await getLinkedinToken(session.user.id)
  if (!accessToken) return Response.json({ error: 'LinkedIn not connected' }, { status: 400 })

  try {
    // Fetch organizations user is admin of
    const res = await axios.get(
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=50&projection=(elements*(organization~(id,localizedName,vanityName)))',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    )

    const elements = res.data?.elements || []
    const pages = elements
      .map((el: { 'organization~'?: { id?: number; localizedName?: string; vanityName?: string }; organization?: string }) => {
        const org = el['organization~']
        if (!org?.id) return null
        return {
          id: String(org.id),
          name: org.localizedName || org.vanityName || `Organization ${org.id}`,
          urn: el.organization,
        }
      })
      .filter(Boolean)

    return Response.json({ pages })
  } catch (err) {
    const msg = axios.isAxiosError(err) ? err.response?.data : String(err)
    console.error('[linkedin/pages] fetch failed:', msg)
    // Return empty with reason — likely missing r_organization_admin scope
    return Response.json({ pages: [], error: 'Could not fetch pages. Ensure r_organization_admin scope is approved in your LinkedIn app.' })
  }
}

// POST — save selected page (or clear to post as personal)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { pageId, pageName } = await req.json()

  await connectDB()
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(session.user.id) },
    {
      $set: {
        'connections.linkedin.pageId': pageId || '',
        'connections.linkedin.pageName': pageName || '',
      },
    }
  )

  return Response.json({ success: true })
}
