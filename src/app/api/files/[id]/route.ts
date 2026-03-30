import { NextRequest, NextResponse } from 'next/server'
import { getFileById } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 })
    const file = await getFileById(id)
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    return NextResponse.json(file)
  } catch (err) {
    console.error('[GET /api/files/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 })
  }
}
