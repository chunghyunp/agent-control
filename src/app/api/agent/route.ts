import { NextResponse } from 'next/server'
import { SOULS } from '@/lib/souls'

const AGENT_MAX_TOKENS: Record<string, number> = {
  supervisor: 8000,
  frontend: 64000,
  backend: 32000,
  web3: 32000,
  reviewer: 16000,
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not set in .env' },
      { status: 500 }
    )
  }

  const { agentId, message, model } = await req.json()

  const systemPrompt = SOULS[agentId]
  if (!systemPrompt) {
    return NextResponse.json(
      { error: `Unknown agentId: ${agentId}` },
      { status: 400 }
    )
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: AGENT_MAX_TOKENS[agentId] ?? 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status })
  }

  return NextResponse.json(data)
}
