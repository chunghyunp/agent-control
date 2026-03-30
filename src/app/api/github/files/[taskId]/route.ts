import { NextRequest, NextResponse } from 'next/server'
import { getTaskFiles } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const files = await getTaskFiles(params.taskId)
    return NextResponse.json(files)
  } catch (err) {
    console.error('[GET /api/github/files/[taskId]]', err)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
