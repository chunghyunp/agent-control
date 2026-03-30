import { NextResponse } from 'next/server'
import { loadSettings } from '@/lib/settings-store'
import { commitFile } from '@/lib/github'
import { saveTaskFileWithGithub } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      repo?: string         // "owner/repo" or just repo name
      branch: string
      filePath: string
      content: string
      message: string
      agentName?: string
      taskId?: string
    }

    const { branch, filePath, content, message, agentName, taskId } = body

    if (!branch || !filePath || !content || !message) {
      return NextResponse.json(
        { error: 'branch, filePath, content, and message are required' },
        { status: 400 }
      )
    }

    const settings = await loadSettings()
    const token = settings.github.token
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 400 })
    }

    // Parse repo — can be "owner/repo" override or use settings
    let owner = settings.github.owner
    let repo = settings.github.repo
    if (body.repo && body.repo.includes('/')) {
      const parts = body.repo.split('/')
      owner = parts[0]
      repo = parts.slice(1).join('/')
    } else if (body.repo) {
      repo = body.repo
    }

    if (!owner || !repo) {
      return NextResponse.json({ error: 'GitHub owner/repo not configured' }, { status: 400 })
    }

    const result = await commitFile(
      token,
      owner,
      repo,
      branch,
      filePath,
      content,
      message,
    )

    // Save to DB with GitHub URL if taskId provided
    if (taskId) {
      await saveTaskFileWithGithub(taskId, filePath, content, result.fileUrl, agentName)
        .catch(err => console.error('[commit] DB save failed:', err))
    }

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Commit failed'
    console.error('[github/commit]', err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
