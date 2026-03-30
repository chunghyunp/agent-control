import { NextRequest, NextResponse } from 'next/server'
import { createTask, getTasks } from '@/lib/db'

export async function GET() {
  try {
    const tasks = await getTasks()
    return NextResponse.json(tasks)
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, prompt, repoTarget, branch } = body as {
      id: string
      title: string
      prompt?: string
      repoTarget?: string
      branch?: string
    }
    if (!id || !title) {
      return NextResponse.json({ error: 'id and title are required' }, { status: 400 })
    }
    const task = await createTask(id, title, { prompt, repoTarget, branch })
    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
