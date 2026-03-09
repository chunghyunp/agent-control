'use client'

import { useState } from 'react'
import type { Task } from '@/types'

interface TaskHistoryProps {
  tasks: Task[]
}

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'rgba(124,110,246,0.1)', text: '#a78bfa', dot: '#7c6ef6' },
  completed: { bg: 'rgba(16,185,129,0.08)', text: '#34d399', dot: '#10b981' },
  error: { bg: 'rgba(239,68,68,0.08)', text: '#f87171', dot: '#ef4444' },
  pending: { bg: 'rgba(55,65,81,0.3)', text: '#6b7280', dot: '#374151' },
}

export default function TaskHistory({ tasks }: TaskHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (tasks.length === 0) {
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
        No tasks yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '100%', padding: '2px 0' }}>
      {tasks.map(t => {
        const sc = STATUS_COLOR[t.status] ?? STATUS_COLOR.pending
        const isExpanded = expanded === t.id

        return (
          <div key={t.id}>
            <div
              onClick={() => setExpanded(isExpanded ? null : t.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setExpanded(isExpanded ? null : t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                background: t.status === 'active'
                  ? 'rgba(124,110,246,0.05)'
                  : 'rgba(31,41,55,0.3)',
                border: `1px solid ${
                  t.status === 'active'
                    ? 'rgba(124,110,246,0.15)'
                    : 'rgba(55,65,81,0.4)'
                }`,
                transition: 'background 0.2s',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: sc.dot,
                  animation: t.status === 'active' ? 'blink 1.5s infinite' : undefined,
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 9.5, color: '#4b5563', marginTop: 2 }}>
                    {t.created}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: sc.bg,
                  color: sc.text,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {t.status}
                </div>
                <span style={{ color: '#374151', fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && t.result && (
              <div style={{
                margin: '4px 0 4px 20px',
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(13,17,23,0.8)',
                border: '1px solid rgba(31,41,55,0.6)',
                fontSize: 11,
                color: '#9ca3af',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                maxHeight: 220,
                overflowY: 'auto',
                fontFamily: '"DM Mono", monospace',
              }}>
                {t.result}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
