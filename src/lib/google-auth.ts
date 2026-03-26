import axios from 'axios'
import { connectDB } from './mongodb'
import mongoose from 'mongoose'

export async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const params = new URLSearchParams()
    params.set('client_id', (process.env.GOOGLE_CLIENT_ID || '').trim())
    params.set('client_secret', (process.env.GOOGLE_CLIENT_SECRET || '').trim())
    params.set('refresh_token', refreshToken)
    params.set('grant_type', 'refresh_token')

    const res = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.data.access_token ?? null
  } catch {
    return null
  }
}

type GoogleConnField = { accessToken?: string; refreshToken?: string }

export async function getValidGoogleToken(
  userId: string,
  connectionType: 'google' | 'searchConsole' | 'ga4'
): Promise<string | null> {
  await connectDB()
  // Use raw driver to bypass Mongoose schema cache
  const doc = await mongoose.connection.db!
    .collection('users')
    .findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { 'connections.google': 1, 'connections.searchConsole': 1, 'connections.ga4': 1 } }
    ) as { connections?: { google?: GoogleConnField; searchConsole?: GoogleConnField; ga4?: GoogleConnField } } | null

  if (!doc) return null

  // Try requested type first, fall back to the other (tokens are identical — both saved in callback)
  const primary = doc.connections?.[connectionType]
  const fallbackKey = connectionType === 'searchConsole' ? 'google' : connectionType === 'google' ? 'searchConsole' : 'google'
  const fallback = doc.connections?.[fallbackKey]
  const conn: GoogleConnField | undefined = primary?.accessToken ? primary : fallback?.accessToken ? fallback : undefined

  if (!conn?.accessToken) return null
  if (!conn.refreshToken) return conn.accessToken

  const newToken = await refreshGoogleToken(conn.refreshToken)
  if (!newToken) return null

  if (newToken !== conn.accessToken) {
    // Persist refreshed token to both fields
    await mongoose.connection.db!.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          [`connections.${connectionType}.accessToken`]: newToken,
          'connections.google.accessToken': newToken,
          'connections.searchConsole.accessToken': newToken,
          'connections.ga4.accessToken': newToken,
        },
      }
    )
  }

  return newToken
}
