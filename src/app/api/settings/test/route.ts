import { NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

function checkAuth(req: Request): boolean {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected) return true
  return req.headers.get('authorization') === `Bearer ${expected}`
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { provider } = body as { provider: string }

  try {
    switch (provider) {
      case 'github': {
        const { token, owner, repo } = body
        const octokit = new Octokit({ auth: token })
        const { data } = await octokit.repos.get({ owner, repo })
        const { data: commits } = await octokit.repos.listCommits({ owner, repo, per_page: 1 })
        const lastCommit = commits[0]?.commit?.message?.split('\n')[0] ?? 'No commits'
        return NextResponse.json({
          ok: true,
          message: `Connected to ${data.full_name}`,
          detail: `Last commit: ${lastCommit}`,
        })
      }

      case 'anthropic': {
        const { apiKey } = body
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          return NextResponse.json({ ok: false, message: err.error?.message ?? 'Invalid API key' })
        }
        return NextResponse.json({ ok: true, message: 'API key valid' })
      }

      case 'replicate': {
        const { token } = body
        const res = await fetch('https://api.replicate.com/v1/models', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return NextResponse.json({ ok: false, message: 'Invalid Replicate token' })
        return NextResponse.json({ ok: true, message: 'Replicate token valid' })
      }

      case 'privy': {
        const { appId, appSecret } = body
        const res = await fetch(`https://auth.privy.io/api/v1/apps/${appId}`, {
          headers: {
            'privy-app-id': appId,
            Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
          },
        })
        if (!res.ok) return NextResponse.json({ ok: false, message: 'Invalid Privy credentials' })
        return NextResponse.json({ ok: true, message: 'Privy credentials valid' })
      }

      case 'storage': {
        const { provider: storageProvider, bucket, region, accessKey, secretKey, accountId } = body
        if (storageProvider === 'local') {
          return NextResponse.json({ ok: true, message: 'Local storage — no config needed' })
        }
        if (storageProvider === 's3') {
          // Basic connectivity check — attempt to list bucket objects
          const endpoint = `https://${bucket}.s3.${region}.amazonaws.com/?max-keys=1`
          const res = await fetch(endpoint)
          // 403 means creds wrong but bucket exists; 200/204 means accessible
          if (res.status === 404) return NextResponse.json({ ok: false, message: 'Bucket not found' })
          return NextResponse.json({ ok: true, message: `S3 bucket ${bucket} reachable` })
        }
        if (storageProvider === 'r2') {
          const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}`
          const res = await fetch(endpoint, {
            headers: { Authorization: `Bearer ${secretKey}` },
          })
          if (!res.ok) return NextResponse.json({ ok: false, message: 'R2 credentials invalid or bucket not found' })
          return NextResponse.json({ ok: true, message: `R2 bucket ${bucket} accessible` })
        }
        return NextResponse.json({ ok: false, message: 'Unknown storage provider' })
      }

      default:
        return NextResponse.json({ ok: false, message: 'Unknown provider' }, { status: 400 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Connection failed'
    return NextResponse.json({ ok: false, message: msg })
  }
}
