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

// GET — fetch LinkedIn ad accounts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessToken = await getLinkedinToken(session.user.id)
  if (!accessToken) return Response.json({ error: 'LinkedIn not connected' }, { status: 400 })

  try {
    // LinkedIn REST API (versioned) — fetch ad accounts accessible to authenticated user
    const res = await axios.get(
      'https://api.linkedin.com/rest/adAccounts?q=search',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'LinkedIn-Version': '202504',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    )

    const elements = res.data?.elements || []
    const accounts = elements
      .map((el: { id?: number | string; name?: string; status?: string; currency?: string; type?: string }) => {
        if (!el?.id) return null
        return {
          id: String(el.id),
          name: el.name || `Account ${el.id}`,
          status: el.status || '',
          currency: el.currency || '',
          type: el.type || '',
        }
      })
      .filter(Boolean)

    return Response.json({ accounts })
  } catch (err) {
    const msg = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : String(err)
    console.error('[linkedin/adaccounts] fetch failed:', msg)
    return Response.json({ accounts: [], error: 'Could not fetch ad accounts. Ensure r_ads scope is approved in your LinkedIn app.' })
  }
}

// POST — save selected ad account
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId, accountName } = await req.json()
  if (!accountId) return Response.json({ error: 'accountId required' }, { status: 400 })

  await connectDB()
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(session.user.id) },
    {
      $set: {
        'connections.linkedin.adAccountId': accountId,
        'connections.linkedin.adAccountName': accountName || '',
      },
    }
  )

  return Response.json({ success: true })
}
