import { NextResponse } from 'next/server'
import { loadSettings } from '@/lib/settings-store'
import { pushFiles, parseFilesFromOutput, isRepoEmpty, getScaffoldingFiles } from '@/lib/github'

function checkAuth(req: Request): boolean {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return true
  return req.headers.get('authorization') === `Bearer ${expected}`
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    // Option A: raw agent output strings (server parses them)
    rawOutputs?: string[]
    // Option B: pre-parsed files (from Files tab manual push)
    files?: { path: string; content: string }[]
    message: string
    // Optional per-project repo override
    owner?: string
    repo?: string
  }

  // Build deduplicated file map from agent outputs (last write wins per path)
  const agentFiles = new Map<string, string>()

  // From raw agent outputs
  for (const output of body.rawOutputs ?? []) {
    for (const file of parseFilesFromOutput(output)) {
      agentFiles.set(file.path, file.content)
    }
  }

  // From pre-parsed files
  for (const f of body.files ?? []) {
    agentFiles.set(f.path, f.content)
  }

  // Check GitHub config — per-project override takes priority
  const settings = await loadSettings()
  const token = settings.github.token
  const owner = body.owner || settings.github.owner
  const repo = body.repo || settings.github.repo
  const branch = settings.github.branch

  if (!token || !owner || !repo) {
    return NextResponse.json(
      { ok: false, error: 'GitHub not configured in Settings' },
      { status: 400 },
    )
  }

  const targetBranch = branch || 'main'

  try {
    let empty: boolean
    try {
      empty = await isRepoEmpty(token, owner, repo, targetBranch)
    } catch (repoCheckErr) {
      // BUG 6 FIX: Handle cases where repo exists but is completely empty (no commits at all)
      const status = (repoCheckErr as { status?: number })?.status
      if (status === 409) {
        empty = true
      } else {
        throw repoCheckErr
      }
    }

    // If repo is not empty and agents produced no files, nothing to push
    if (!empty && agentFiles.size === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: 'No parseable file blocks found in agent output',
      })
    }

    const allFiles = new Map<string, string>()

    if (empty) {
      // Scaffolding first — agent files override conflicting paths
      for (const f of getScaffoldingFiles(repo)) {
        allFiles.set(f.path, f.content)
      }
    }

    // Agent-generated files override scaffolding
    agentFiles.forEach((content, path) => allFiles.set(path, content))

    const filesToPush = Array.from(allFiles.entries()).map(([path, content]) => ({ path, content }))

    const commitMessage = empty
      ? `chore: initial commit — ${body.message}`
      : body.message

    const result = await pushFiles(token, owner, repo, targetBranch, filesToPush, commitMessage)

    return NextResponse.json({
      ok: true,
      filesCount: result.filesCount,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
      isInitialCommit: empty,
      agentFilesCount: agentFiles.size,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Push failed'
    console.error('[github/push]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
