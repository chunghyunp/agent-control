'use client'

import { useEffect, useState } from 'react'
import type { AgentDef, AgentState } from '@/types'

interface AgentCardProps {
  agent: AgentDef
  state: AgentState
}

const STATUS_STYLES: Record<string, {
  label: string
  bg: string
  text: string
  dot: string
  glow: string
}> = {
  idle: { label: 'Idle', bg: 'rgba(55,65,81,0.3)', text: '#6b7280', dot: '#374151', glow: 'none' },
  working: { label: 'Working', bg: 'rgba(124,110,246,0.12)', text: '#a78bfa', dot: '#7c6ef6', glow: '0 0 10px rgba(124,110,246,0.4)' },
  waiting: { label: 'Queued', bg: 'rgba(245,183,49,0.1)', text: '#fbbf24', dot: '#f59e0b', glow: 'none' },
  done: { label: 'Complete', bg: 'rgba(16,185,129,0.1)', text: '#34d399', dot: '#10b981', glow: 'none' },
  error: { label: 'Error', bg: 'rgba(239,68,68,0.1)', text: '#f87171', dot: '#ef4444', glow: '0 0 10px rgba(239,68,68,0.35)' },
  reviewing: { label: 'Reviewing', bg: 'rgba(245,183,49,0.1)', text: '#fbbf24', dot: '#f59e0b', glow: '0 0 10px rgba(245,183,49,0.2)' },
}

export default function AgentCard({ agent, state }: AgentCardProps) {
  const s = STATUS_STYLES[state.status] ?? STATUS_STYLES.idle
  const isActive = state.status === 'working'
  const [elapsed, setElapsed] = useState<number | null>(null)

  useEffect(() => {
    if (!isActive || !state.startedAt) {
      setElapsed(null)
      return
    }
    const tick = () => setElapsed(Math.floor((Date.now() - state.startedAt!) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, state.startedAt])

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(13,17,23,0.95), rgba(17,22,34,0.9))',
      border: `1px solid ${isActive ? agent.color + '35' : 'rgba(31,41,55,0.8)'}`,
      borderRadius: 14,
      padding: '16px 18px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.45s cubic-bezier(0.23, 1, 0.32, 1)',
      boxShadow: isActive ? `0 4px 28px ${agent.color}18` : '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      {/* Scanline top bar for active agents */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)`,
          animation: 'scanline 2.5s ease-in-out infinite',
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${agent.color}10`,
            border: `1px solid ${agent.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}>
            {agent.icon}
          </div>
          <div>
            <div style={{ fontWeight: 650, fontSize: 13, color: '#d1d5db', letterSpacing: '-0.01em' }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 9.5, color: '#4b5563', marginTop: 1.5, letterSpacing: '0.02em' }}>
              {agent.role}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: s.bg,
          padding: '3px 9px',
          borderRadius: 20,
          fontSize: 9.5,
          fontWeight: 600,
          color: s.text,
          flexShrink: 0,
        }}>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: s.dot,
            boxShadow: s.glow === 'none' ? undefined : s.glow,
            animation: (isActive || state.status === 'error') ? 'blink 1.2s infinite' : undefined,
          }} />
          {s.label}
        </div>
      </div>

      {/* Progress bar — only when working */}
      {isActive && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 9, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Progress
            </span>
            <span style={{ fontSize: 9.5, color: agent.color, fontWeight: 600, fontFamily: '"DM Mono", monospace' }}>
              {state.progress}%{elapsed !== null ? ` · ${elapsed}s` : ''}
            </span>
          </div>
          <div style={{ height: 3, background: 'rgba(120,140,170,0.07)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 6,
              width: `${state.progress}%`,
              background: `linear-gradient(90deg, ${agent.color}70, ${agent.color})`,
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        </div>
      )}

      {/* Token summary when done */}
      {state.status === 'done' && (state.tokensIn > 0 || state.tokensOut > 0) && (
        <div style={{ marginTop: 9, display: 'flex', gap: 10, fontSize: 9.5, color: '#4b5563', fontFamily: '"DM Mono", monospace' }}>
          <span style={{ color: '#6b7280' }}>↑{(state.tokensIn / 1000).toFixed(1)}K</span>
          <span style={{ color: '#6b7280' }}>↓{(state.tokensOut / 1000).toFixed(1)}K</span>
          <span style={{ marginLeft: 'auto', color: '#374151' }}>
            ${(
              (state.tokensIn / 1_000_000 * agent.costIn) +
              (state.tokensOut / 1_000_000 * agent.costOut)
            ).toFixed(4)}
          </span>
        </div>
      )}
    </div>
  )
}
