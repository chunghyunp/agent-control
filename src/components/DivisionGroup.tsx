'use client'

import type { AgentDef, AgentState, Division } from '@/types'
import AgentCard from './AgentCard'

interface DivisionGroupProps {
  division: Division
  label: string
  agents: AgentDef[]
  agentStates: Record<string, AgentState>
  color: string
}

const DIVISION_META: Record<Division, { icon: string; tagline: string }> = {
  command: { icon: '⌘', tagline: 'Orchestration & Architecture' },
  design: { icon: '◆', tagline: 'Research · UI · Brand' },
  engineering: { icon: '⚡', tagline: 'Frontend · Backend · Web3 · Security · Docs' },
  testing: { icon: '✦', tagline: 'Code Review · Contract Audit' },
}

export default function DivisionGroup({ division, label, agents, agentStates, color }: DivisionGroupProps) {
  const meta = DIVISION_META[division]
  const activeCount = agents.filter(a => agentStates[a.id]?.status === 'working').length
  const doneCount = agents.filter(a => agentStates[a.id]?.status === 'done').length

  return (
    <div style={{
      background: 'rgba(13,17,23,0.4)',
      border: `1px solid ${color}18`,
      borderRadius: 16,
      padding: '12px 14px 14px',
      minWidth: 0,
    }}>
      {/* Division header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `1px solid ${color}12`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12,
            color: color,
            opacity: 0.7,
          }}>
            {meta.icon}
          </span>
          <div>
            <div style={{
              fontSize: 8,
              fontWeight: 700,
              color: color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: '"Press Start 2P", monospace',
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 8.5,
              color: '#4b5563',
              marginTop: 1,
              letterSpacing: '0.02em',
            }}>
              {meta.tagline}
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div style={{
          display: 'flex',
          gap: 6,
          fontSize: 9,
          fontFamily: '"DM Mono", monospace',
          color: '#4b5563',
        }}>
          {activeCount > 0 && (
            <span style={{ color: '#a78bfa' }}>
              {activeCount} active
            </span>
          )}
          {doneCount > 0 && (
            <span style={{ color: '#34d399' }}>
              {doneCount}✓
            </span>
          )}
        </div>
      </div>

      {/* Agent cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: division === 'command'
          ? 'repeat(auto-fit, minmax(160px, 1fr))'
          : '1fr',
        gap: 8,
      }}>
        {agents.map(a => (
          <AgentCard key={a.id} agent={a} state={agentStates[a.id]} />
        ))}
      </div>
    </div>
  )
}
