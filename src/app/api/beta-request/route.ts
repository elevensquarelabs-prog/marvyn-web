import { NextRequest } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import BetaRequest from '@/models/BetaRequest'

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, team_size, use_case } = await req.json()

    if (!name || !email || !company) {
      return Response.json({ error: 'name, email and company are required' }, { status: 400 })
    }

    await connectDB()

    const existing = await BetaRequest.findOne({ email: email.toLowerCase().trim() })
    if (existing) {
      // Silently succeed — don't leak that the email is already registered
      return Response.json({ success: true })
    }

    await BetaRequest.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      company: company.trim(),
      teamSize: team_size ?? '',
      useCase: use_case ?? '',
      status: 'pending',
    })

    console.log(`[beta-request] New request from ${email} (${company})`)

    return Response.json({ success: true })
  } catch (err) {
    const e = err as { message?: string }
    console.error('[beta-request] Error:', e.message)
    return Response.json({ error: 'Failed to submit request' }, { status: 500 })
  }
}
