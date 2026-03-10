import { NextResponse } from 'next/server'
import { loadSettings } from '@/lib/settings-store'
import { pushFiles } from '@/lib/github'

function checkAuth(req: Request): boolean {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return true
  return req.headers.get('authorization') === `Bearer ${expected}`
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { files, message } = await req.json() as {
    files: { path: string; content: string }[]
    message: string
  }

  const settings = await loadSettings()
  const { token, owner, repo, branch } = settings.github

  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'GitHub not configured in Settings' }, { status: 400 })
  }

  try {
    const result = await pushFiles(token, owner, repo, branch || 'main', files, message)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Push failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
