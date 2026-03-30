import { NextRequest, NextResponse } from 'next/server'
import { loadSettings } from '@/lib/settings-store'
import { fetchFileContent } from '@/lib/github'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repoParam = searchParams.get('repo')
    const branch = searchParams.get('branch')
    const filePath = searchParams.get('filePath')

    if (!branch || !filePath) {
      return NextResponse.json({ error: 'branch and filePath are required' }, { status: 400 })
    }

    const settings = await loadSettings()
    const token = settings.github.token
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 400 })
    }

    let owner = settings.github.owner
    let repo = settings.github.repo
    if (repoParam && repoParam.includes('/')) {
      const parts = repoParam.split('/')
      owner = parts[0]
      repo = parts.slice(1).join('/')
    } else if (repoParam) {
      repo = repoParam
    }

    if (!owner || !repo) {
      return NextResponse.json({ error: 'GitHub owner/repo not configured' }, { status: 400 })
    }

    const result = await fetchFileContent(token, owner, repo, branch, filePath)
    return NextResponse.json({ ok: true, content: result.content, sha: result.sha })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch file content'
    console.error('[github/file-content]', err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
