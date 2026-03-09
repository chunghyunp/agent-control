'use client'

import type { AgentDef, AgentState } from '@/types'

interface CostBreakdownProps {
  agentDefs: AgentDef[]
  agentStates: Record<string, AgentState>
}

export default function CostBreakdown({ agentDefs, agentStates }: CostBreakdownProps) {
  const agentCosts = agentDefs.map(a => {
    const s = agentStates[a.id]
    const cost = (s.tokensIn / 1_000_000 * a.costIn) + (s.tokensOut / 1_000_000 * a.costOut)
    return { ...a, tokensIn: s.tokensIn, tokensOut: s.tokensOut, cost }
  }).filter(a => a.tokensIn > 0 || a.tokensOut > 0)

  const totalCost = agentCosts.reduce((sum, a) => sum + a.cost, 0)
  const totalTokens = agentCosts.reduce((sum, a) => sum + a.tokensIn + a.tokensOut, 0)

  if (agentCosts.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        color: '#4b5563',
        fontSize: 12,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        No API calls yet. Send a task to see the cost breakdown.
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          flex: 1,
          background: 'rgba(124,110,246,0.07)',
          borderRadius: 10,
          padding: '13px 16px',
          border: '1px solid rgba(124,110,246,0.12)',
        }}>
          <div style={{ fontSize: 9, color: '#7c6ef6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Total Cost
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e5e7eb', fontFamily: '"DM Mono", monospace' }}>
            ${totalCost.toFixed(4)}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: 'rgba(16,185,129,0.07)',
          borderRadius: 10,
          padding: '13px 16px',
          border: '1px solid rgba(16,185,129,0.12)',
        }}>
          <div style={{ fontSize: 9, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Tokens Used
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#e5e7eb', fontFamily: '"DM Mono", monospace' }}>
            {(totalTokens / 1000).toFixed(1)}K
          </div>
        </div>
      </div>

      {/* Per-agent rows */}
      {agentCosts.map(a => {
        const pct = totalCost > 0 ? (a.cost / totalCost) * 100 : 0
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>{a.name}</span>
                <span style={{ fontSize: 9.5, color: '#6b7280', fontFamily: '"DM Mono", monospace' }}>
                  ${a.cost.toFixed(4)} · {((a.tokensIn + a.tokensOut) / 1000).toFixed(1)}K tok
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(55,65,81,0.5)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: a.color,
                  borderRadius: 6,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
