import { NextRequest, NextResponse } from 'next/server'
import { prisma, updateTaskStatus, updateTaskPipeline, updateTaskMeta, getLogs, getCosts, getTaskFiles, deleteTask } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const task = await prisma.task.findUnique({ where: { id: params.id } })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    const [logs, costs, files] = await Promise.all([getLogs(params.id), getCosts(params.id), getTaskFiles(params.id)])
    return NextResponse.json({ ...task, logs, costs, files })
  } catch (err) {
    console.error('[GET /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteTask(params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, result, pipeline, totalCost, agentCount, branch, repoTarget } = body as {
      status?: string
      result?: string
      pipeline?: string
      totalCost?: number
      agentCount?: number
      branch?: string
      repoTarget?: string
    }

    if (pipeline !== undefined) {
      await updateTaskPipeline(params.id, pipeline)
    }
    if (status !== undefined) {
      await updateTaskStatus(params.id, status, result)
    }
    if (totalCost !== undefined || agentCount !== undefined || branch !== undefined || repoTarget !== undefined) {
      await updateTaskMeta(params.id, {
        ...(totalCost !== undefined ? { totalCost } : {}),
        ...(agentCount !== undefined ? { agentCount } : {}),
        ...(branch !== undefined ? { branch } : {}),
        ...(repoTarget !== undefined ? { repoTarget } : {}),
      })
    }

    const updated = await prisma.task.findUnique({ where: { id: params.id } })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
