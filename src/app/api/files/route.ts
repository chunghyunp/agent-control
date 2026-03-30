import { NextResponse } from 'next/server'
import { getAllFiles } from '@/lib/db'

export async function GET() {
  try {
    const files = await getAllFiles()
    return NextResponse.json(files)
  } catch (err) {
    console.error('[GET /api/files]', err)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
