import { NextResponse } from 'next/server'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'

export const maxDuration = 120 // allow up to 2 minutes

export async function POST(req: Request) {
  const body = await req.json() as {
    files: { path: string; content: string }[]
  }

  const buildDir = join(tmpdir(), `build-check-${randomUUID()}`)

  try {
    // 1. Write all files to temp directory
    for (const file of body.files) {
      const fullPath = join(buildDir, file.path)
      const dir = fullPath.slice(0, fullPath.lastIndexOf('/'))
      await mkdir(dir, { recursive: true })
      await writeFile(fullPath, file.content, 'utf-8')
    }

    // 2. Run npm install
    try {
      execSync('npm install --ignore-scripts 2>&1', {
        cwd: buildDir,
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, NODE_ENV: 'development' },
      })
    } catch (installErr) {
      const stderr = installErr instanceof Error && 'stderr' in installErr
        ? String((installErr as { stderr: unknown }).stderr)
        : String(installErr)
      const stdout = installErr instanceof Error && 'stdout' in installErr
        ? String((installErr as { stdout: unknown }).stdout)
        : ''
      return NextResponse.json({
        ok: false,
        phase: 'install',
        error: (stderr || stdout).slice(-3000),
      })
    }

    // 3. Run npm run build
    try {
      execSync('npm run build 2>&1', {
        cwd: buildDir,
        timeout: 90_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, NODE_ENV: 'production' },
      })
    } catch (buildErr) {
      const stderr = buildErr instanceof Error && 'stderr' in buildErr
        ? String((buildErr as { stderr: unknown }).stderr)
        : String(buildErr)
      const stdout = buildErr instanceof Error && 'stdout' in buildErr
        ? String((buildErr as { stdout: unknown }).stdout)
        : ''
      // Extract just the error lines, not the full webpack output
      const fullOutput = stdout || stderr
      const errorLines = fullOutput
        .split('\n')
        .filter((line: string) =>
          /error|Error|failed|Failed|Cannot find|Module not found|not assignable|Property .* does not exist|Expected|Unexpected|SyntaxError/i.test(line)
        )
        .slice(0, 40)
        .join('\n')

      return NextResponse.json({
        ok: false,
        phase: 'build',
        error: errorLines || fullOutput.slice(-3000),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, phase: 'unknown', error: msg }, { status: 500 })
  } finally {
    // Cleanup temp directory
    await rm(buildDir, { recursive: true, force: true }).catch(() => null)
  }
}
