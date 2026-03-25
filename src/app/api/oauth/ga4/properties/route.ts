import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getValidGoogleToken } from '@/lib/google-auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'
import axios from 'axios'

interface PropertySummary {
  property: string
  displayName: string
  parent: string
}

interface AccountSummary {
  displayName: string
  propertySummaries?: PropertySummary[]
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessToken = await getValidGoogleToken(session.user.id, 'ga4')
  if (!accessToken) return Response.json({ error: 'GA4 not connected' }, { status: 400 })

  try {
    const res = await axios.get('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const properties = ((res.data.accountSummaries || []) as AccountSummary[]).flatMap((account) =>
      (account.propertySummaries || []).map((property) => ({
        propertyId: property.property.replace('properties/', ''),
        propertyName: property.displayName,
        accountName: account.displayName,
      }))
    )

    return Response.json({ properties })
  } catch (err) {
    console.error('[ga4/properties] fetch failed:', err)
    return Response.json({ error: 'Failed to fetch GA4 properties' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyId, propertyName, accountName } = await req.json()
  if (!propertyId) return Response.json({ error: 'propertyId is required' }, { status: 400 })

  await connectDB()
  await mongoose.connection.db!.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId(session.user.id) },
    {
      $set: {
        'connections.ga4.propertyId': propertyId,
        'connections.ga4.propertyName': propertyName || '',
        'connections.ga4.accountName': accountName || '',
        'connections.ga4.connectedAt': new Date(),
      },
    }
  )

  return Response.json({ success: true })
}
