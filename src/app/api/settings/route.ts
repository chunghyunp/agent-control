import { NextResponse } from 'next/server'
import { loadSettings, saveSettings } from '@/lib/settings-store'

function checkAuth(req: Request): boolean {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return true // no password set → open
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${expected}`
}

export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await loadSettings()
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await req.json()
  await saveSettings(settings)
  return NextResponse.json({ ok: true })
}
