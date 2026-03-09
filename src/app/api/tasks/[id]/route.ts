import { NextRequest, NextResponse } from 'next/server'
import { prisma, updateTaskStatus, updateTaskPipeline, getLogs, getCosts } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({ where: { id: params.id } })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    const [logs, costs] = await Promise.all([getLogs(params.id), getCosts(params.id)])
    return NextResponse.json({ ...task, logs, costs })
  } catch (err) {
    console.error('[GET /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, result, pipeline } = body as {
      status?: string
      result?: string
      pipeline?: string
    }

    if (pipeline !== undefined) {
      await updateTaskPipeline(params.id, pipeline)
    }
    if (status !== undefined) {
      await updateTaskStatus(params.id, status, result)
    }

    const updated = await prisma.task.findUnique({ where: { id: params.id } })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
