import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import axios from 'axios'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const user = await User.findById(session.user.id)
  const meta = user?.connections?.meta

  if (!meta?.accessToken) {
    return Response.json({ error: 'Meta not connected' }, { status: 400 })
  }

  try {
    const res = await axios.get('https://graph.facebook.com/v21.0/me/adaccounts', {
      params: {
        access_token: meta.accessToken,
        fields: 'id,name,account_status,currency',
        limit: 50,
      },
    })

    const accounts = (res.data.data || []).map((a: {
      id: string
      name: string
      account_status: number
      currency: string
    }) => ({
      id: a.id,
      name: a.name,
      status: a.account_status,
      currency: a.currency,
    }))

    return Response.json({ accounts })
  } catch (err) {
    console.error('[meta/adaccounts]', err)
    return Response.json({ error: 'Failed to fetch ad accounts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { accountId, accountName } = await req.json()
  // Meta returns ids as "act_XXXXXX" — strip the prefix so routes can safely prepend it
  const cleanId = String(accountId).replace(/^act_/, '')

  await User.findByIdAndUpdate(session.user.id, {
    $set: {
      'connections.meta.accountId': cleanId,
      'connections.meta.accountName': accountName,
    },
  })

  return Response.json({ success: true })
}
