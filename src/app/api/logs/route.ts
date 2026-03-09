import { NextRequest, NextResponse } from 'next/server'
import { insertLog } from '@/lib/db'
import { emit } from '@/lib/socket'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, agent, type, message } = body as {
      taskId: string
      agent: string
      type: string
      message: string
    }

    if (!taskId || !agent || !type || !message) {
      return NextResponse.json({ error: 'taskId, agent, type, message are required' }, { status: 400 })
    }

    const log = await insertLog(taskId, agent, type, message)
    emit('log', { taskId, agent, type, message, id: log.id, createdAt: log.createdAt })

    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    console.error('[POST /api/logs]', err)
    return NextResponse.json({ error: 'Failed to insert log' }, { status: 500 })
  }
}
