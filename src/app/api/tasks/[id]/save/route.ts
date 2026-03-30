import { NextRequest, NextResponse } from 'next/server'
import { saveTaskFiles } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { files } = body as { files: Record<string, string> }
    if (!files || typeof files !== 'object') {
      return NextResponse.json({ error: 'files object is required' }, { status: 400 })
    }
    const count = Object.keys(files).length
    if (count === 0) {
      return NextResponse.json({ ok: true, count: 0 })
    }
    await saveTaskFiles(params.id, files)
    return NextResponse.json({ ok: true, count })
  } catch (err) {
    console.error('[POST /api/tasks/[id]/save]', err)
    return NextResponse.json({ error: 'Failed to save files' }, { status: 500 })
  }
}
