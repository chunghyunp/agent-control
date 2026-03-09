import { NextRequest, NextResponse } from 'next/server'
import { emit } from '@/lib/socket'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, data } = body as { event: string; data: object }

    if (!event) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 })
    }

    emit(event, data ?? {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/emit]', err)
    return NextResponse.json({ error: 'Failed to emit event' }, { status: 500 })
  }
}
