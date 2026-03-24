// ─── AGENT MODELS ───────────────────────────────────────────────────
export const AGENT_MODELS: Record<string, string> = {
  // Command
  orchestrator: 'claude-opus-4-6',
  architect: 'claude-opus-4-6',
  // Design
  'ux-researcher': 'claude-sonnet-4-6',
  'ui-designer': 'claude-sonnet-4-6',
  'brand-guardian': 'claude-sonnet-4-6',
  // Engineering
  frontend: 'claude-sonnet-4-6',
  backend: 'claude-sonnet-4-6',
  web3: 'claude-opus-4-6',
  security: 'claude-opus-4-6',
  'tech-writer': 'claude-sonnet-4-6',
  // Testing
  'code-reviewer': 'claude-opus-4-6',
  'blockchain-auditor': 'claude-opus-4-6',
}

// ─── PRICING (USD per 1M tokens) ────────────────────────────────────
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 15, output: 75 },
}
