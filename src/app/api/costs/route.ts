import { NextRequest, NextResponse } from 'next/server'
import { upsertCost } from '@/lib/db'
import { emit } from '@/lib/socket'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, agent, inputTokens, outputTokens, costUsd } = body as {
      taskId: string
      agent: string
      inputTokens: number
      outputTokens: number
      costUsd: number
    }

    if (!taskId || !agent) {
      return NextResponse.json({ error: 'taskId and agent are required' }, { status: 400 })
    }

    const cost = await upsertCost(taskId, agent, inputTokens, outputTokens, costUsd)
    emit('cost', { taskId, agent, inputTokens, outputTokens, costUsd })

    return NextResponse.json(cost, { status: 201 })
  } catch (err) {
    console.error('[POST /api/costs]', err)
    return NextResponse.json({ error: 'Failed to upsert cost' }, { status: 500 })
  }
}
