import { NextResponse } from 'next/server'
import { loadSettings } from '@/lib/settings-store'
import { createBranch } from '@/lib/github'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      repo?: string
      baseBranch?: string
      newBranch: string
    }

    const { newBranch } = body
    if (!newBranch) {
      return NextResponse.json({ error: 'newBranch is required' }, { status: 400 })
    }

    const settings = await loadSettings()
    const token = settings.github.token
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 400 })
    }

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

    const baseBranch = body.baseBranch || settings.github.branch || 'main'

    const result = await createBranch(token, owner, repo, baseBranch, newBranch)

    return NextResponse.json({
      ok: true,
      branch: newBranch,
      sha: result.sha,
      url: `https://github.com/${owner}/${repo}/tree/${newBranch}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Branch creation failed'
    console.error('[github/create-branch]', err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
