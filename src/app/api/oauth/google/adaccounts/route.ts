import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const doc = await mongoose.connection.db!
      .collection('users')
      .findOne(
        { _id: new mongoose.Types.ObjectId(session.user.id) },
        { projection: { 'connections.google': 1 } }
      )

    const accessToken = (doc as { connections?: { google?: { accessToken?: string } } } | null)
      ?.connections?.google?.accessToken

    if (!accessToken) {
      console.log('[Google Ads] No access token found')
      return Response.json({ accounts: [], manualEntry: true, error: 'No Google token' })
    }

    const devToken = process.env.GOOGLE_DEVELOPER_TOKEN
    if (!devToken) {
      console.log('[Google Ads] GOOGLE_DEVELOPER_TOKEN not set')
      return Response.json({ accounts: [], manualEntry: true, error: 'No developer token' })
    }

    const res = await fetch('https://googleads.googleapis.com/v19/customers:listAccessibleCustomers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': devToken,
      },
    })

    const data = await res.json()
    console.log('[Google Ads] listAccessibleCustomers status:', res.status)
    console.log('[Google Ads] listAccessibleCustomers response:', JSON.stringify(data))

    if (!res.ok || !data.resourceNames || data.resourceNames.length === 0) {
      return Response.json({ accounts: [], manualEntry: true })
    }

    const accounts = data.resourceNames.map((name: string) => ({
      id: name.replace('customers/', ''),
      name: name.replace('customers/', ''),
    }))

    return Response.json({ accounts, manualEntry: false })
  } catch (error: unknown) {
    const e = error as { message?: string }
    console.error('[Google Ads] Error:', e.message)
    return Response.json({ accounts: [], manualEntry: true, error: e.message })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()
    const { customerId, customerName } = await req.json()

    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(session.user.id) },
      {
        $set: {
          'connections.google.customerId': customerId,
          'connections.google.customerName': customerName,
        },
      }
    )

    return Response.json({ success: true })
  } catch (error: unknown) {
    const e = error as { message?: string }
    console.error('[Google Ads POST] Error:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
