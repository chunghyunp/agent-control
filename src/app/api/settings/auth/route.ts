import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { password } = await req.json()
  const expected = process.env.DASHBOARD_PASSWORD

  // If no password is set, auth is always open (local dev)
  if (!expected || password === expected) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false, error: 'Wrong password' }, { status: 401 })
}
