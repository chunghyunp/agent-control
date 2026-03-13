// ─── AGENT MODELS ───────────────────────────────────────────────────
export const AGENT_MODELS: Record<string, string> = {
  supervisor: 'claude-sonnet-4-6',
  designer: 'claude-sonnet-4-6',
  frontend: 'claude-sonnet-4-6',
  backend: 'claude-sonnet-4-6',
  web3: 'claude-opus-4-6',
  reviewer: 'claude-opus-4-6',
}

// ─── PRICING (USD per 1M tokens) ────────────────────────────────────
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 15, output: 75 },
}
