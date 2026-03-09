import { NextResponse } from 'next/server'

export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: hasKey,
  })
}
