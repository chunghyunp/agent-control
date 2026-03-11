'use client'

import { useState } from 'react'
import type { AgentDef, AgentState, CostEntry } from '@/types'

interface SummaryViewProps {
  agents: AgentDef[]
  agentStates: Record<string, AgentState>
  costs: Record<string, CostEntry>
  isRunning: boolean
  totalExpectedFiles?: number
  generatedFileCount?: number
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  done:      { label: 'Complete',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  error:     { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
  working:   { label: 'Working…',  color: '#7c6ef6', bg: 'rgba(124,110,246,0.1)' },
  reviewing: { label: 'Reviewing…',color: '#7c6ef6', bg: 'rgba(124,110,246,0.1)' },
  waiting:   { label: 'Waiting',   color: '#6b7280', bg: 'rgba(55,65,81,0.15)'  },
  idle:      { label: 'Idle',      color: '#4b5563', bg: 'rgba(31,41,55,0.2)'   },
}

function fmt(n: number) { return n.toLocaleString() }
function fmtCost(n: number) { return n < 0.0001 ? '< $0.0001' : `$${n.toFixed(4)}` }

export default function SummaryView({ agents, agentStates, costs, isRunning, totalExpectedFiles = 0, generatedFileCount = 0 }: SummaryViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const activeAgents = agents.filter(a => agentStates[a.id].status !== 'idle')
  const totalTokens = Object.values(costs).reduce((s, c) => s + c.inputTokens + c.outputTokens, 0)
  const totalCost   = Object.values(costs).reduce((s, c) => s + c.costUsd, 0)
  const totalFiles  = Object.values(agentStates).reduce((s, a) => s + a.files.length, 0)

  const showProgress = totalExpectedFiles > 0
  const progressPct = showProgress ? Math.min(100, Math.round((generatedFileCount / totalExpectedFiles) * 100)) : 0

  if (!isRunning && activeAgents.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#374151', fontSize: 12,
      }}>
        No task run yet — summary will appear here when agents complete.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {/* Progress bar — shown when file plan is active */}
      {showProgress && (
        <div style={{
          padding: '8px 16px 12px',
          borderBottom: '1px solid rgba(31,41,55,0.4)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
              Files generated
            </span>
            <span style={{
              fontSize: 11,
              fontFamily: '"DM Mono", monospace',
              color: progressPct === 100 ? '#10b981' : '#a89cf7',
              fontWeight: 600,
            }}>
              {generatedFileCount}/{totalExpectedFiles} ({progressPct}%)
            </span>
          </div>
          <div style={{
            height: 4,
            background: 'rgba(31,41,55,0.6)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: progressPct === 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : 'linear-gradient(90deg, #7c6ef6, #b38cfa)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}
      {/* Agent rows */}
      {agents.map(agent => {
        const st = agentStates[agent.id]
        if (st.status === 'idle') return null

        const cost = costs[agent.id]
        const tokens = cost ? cost.inputTokens + cost.outputTokens : 0
        const style = STATUS_STYLE[st.status] ?? STATUS_STYLE.idle
        const isExpanded = expanded.has(agent.id)

        return (
          <div key={agent.id} style={{
            borderBottom: '1px solid rgba(31,41,55,0.4)',
          }}>
            {/* Main row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '28px 140px 100px 80px 70px 1fr auto',
              alignItems: 'center',
              gap: 0,
              padding: '10px 16px',
              fontSize: 12,
            }}>
              {/* Icon */}
              <span style={{ fontSize: 14 }}>{agent.icon}</span>

              {/* Agent name */}
              <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{agent.name}</span>

              {/* Status badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: style.bg,
                color: style.color,
                padding: '2px 8px', borderRadius: 5,
                fontSize: 11, fontWeight: 500,
                width: 'fit-content',
              }}>
                {st.status === 'done' ? '✓' : st.status === 'error' ? '✗' : '…'} {style.label}
              </span>

              {/* Tokens */}
              <span style={{ color: '#6b7280', fontFamily: '"DM Mono", monospace', fontSize: 11 }}>
                {tokens > 0 ? fmt(tokens) : '—'}
              </span>

              {/* Cost */}
              <span style={{ color: '#9ca3af', fontFamily: '"DM Mono", monospace', fontSize: 11 }}>
                {cost ? fmtCost(cost.costUsd) : '—'}
              </span>

              {/* File paths */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingRight: 8 }}>
                {st.files.length === 0
                  ? <span style={{ color: '#374151', fontSize: 11 }}>—</span>
                  : st.files.map(f => (
                    <span key={f} style={{
                      background: 'rgba(55,65,81,0.4)',
                      color: '#9ca3af',
                      padding: '1px 6px', borderRadius: 4,
                      fontSize: 10, fontFamily: '"DM Mono", monospace',
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{f}</span>
                  ))
                }
              </div>

              {/* View Output button */}
              {st.output && (
                <button
                  onClick={() => toggle(agent.id)}
                  style={{
                    background: isExpanded ? 'rgba(124,110,246,0.15)' : 'rgba(31,41,55,0.5)',
                    border: `1px solid ${isExpanded ? 'rgba(124,110,246,0.3)' : 'rgba(55,65,81,0.4)'}`,
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 10.5,
                    color: isExpanded ? '#a89cf7' : '#6b7280',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {isExpanded ? 'Hide ▲' : 'View Output ▼'}
                </button>
              )}
            </div>

            {/* Expanded output panel */}
            {isExpanded && st.output && (
              <div style={{
                margin: '0 16px 12px',
                background: 'rgba(5,8,15,0.7)',
                border: '1px solid rgba(31,41,55,0.6)',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '6px 12px',
                  background: 'rgba(17,24,39,0.5)',
                  borderBottom: '1px solid rgba(31,41,55,0.5)',
                  fontSize: 10,
                  color: '#4b5563',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span>{agent.name} output</span>
                  <span>{st.output.length.toLocaleString()} chars</span>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '12px',
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: '#d1d5db',
                  fontFamily: '"DM Mono", "Fira Code", monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 320,
                  overflowY: 'auto',
                }}>
                  {st.output}
                </pre>
              </div>
            )}
          </div>
        )
      })}

      {/* Totals row */}
      {activeAgents.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 140px 100px 80px 70px 1fr auto',
          alignItems: 'center',
          gap: 0,
          padding: '10px 16px',
          borderTop: '1px solid rgba(55,65,81,0.3)',
          background: 'rgba(17,24,39,0.3)',
          fontSize: 11.5,
        }}>
          <span />
          <span style={{ color: '#6b7280', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>TOTAL</span>
          <span />
          <span style={{ color: '#e5e7eb', fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 600 }}>
            {totalTokens > 0 ? fmt(totalTokens) : '—'}
          </span>
          <span style={{ color: '#a89cf7', fontFamily: '"DM Mono", monospace', fontSize: 11, fontWeight: 600 }}>
            {totalCost > 0 ? fmtCost(totalCost) : '—'}
          </span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>
            {totalFiles > 0 ? `${totalFiles} file${totalFiles !== 1 ? 's' : ''}` : '—'}
          </span>
          <span />
        </div>
      )}
    </div>
  )
}
