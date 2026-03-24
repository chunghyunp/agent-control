'use client'

import type { PipelineStep, AgentDef } from '@/types'
import PixelAvatar from './PixelAvatar'

interface PipelineVizProps {
  steps: PipelineStep[]
  agents: AgentDef[]
  taskTitle?: string
}

const STATUS_STYLES: Record<string, { text: string; dot: string }> = {
  idle: { text: '#6b7280', dot: '#374151' },
  working: { text: '#a78bfa', dot: '#7c6ef6' },
  waiting: { text: '#fbbf24', dot: '#f59e0b' },
  done: { text: '#34d399', dot: '#10b981' },
  error: { text: '#f87171', dot: '#ef4444' },
}

export default function PipelineViz({ steps, agents, taskTitle }: PipelineVizProps) {
  return (
    <div style={{
      background: 'rgba(13,17,23,0.6)',
      border: '1px solid rgba(31,41,55,0.8)',
      borderRadius: 14,
      padding: '14px 20px',
      marginBottom: 14,
    }}>
      <div style={{
        fontSize: 9.5,
        color: '#4b5563',
        fontWeight: 600,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        Pipeline{taskTitle ? ` — ${taskTitle}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((step, i) => {
          const agent = agents.find(a => a.id === step.agent)
          const s = STATUS_STYLES[step.status] ?? STATUS_STYLES.idle
          const isActive = step.status === 'working'
          const isDone = step.status === 'done'
          const isError = step.status === 'error'

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                {/* Circle node */}
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: isDone
                    ? `${agent?.color ?? '#10b981'}14`
                    : isActive
                    ? `${agent?.color ?? '#7c6ef6'}20`
                    : 'rgba(31,41,55,0.5)',
                  border: `2px solid ${
                    isDone
                      ? (agent?.color ?? '#10b981') + '60'
                      : isActive
                      ? (agent?.color ?? '#7c6ef6')
                      : 'rgba(55,65,81,0.6)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: isDone ? '#10b981' : isError ? '#ef4444' : s.text,
                  animation: isActive ? 'pulseGlow 2s infinite' : undefined,
                  transition: 'all 0.4s ease',
                }}>
                  {isDone ? '✓' : isError ? '✕' : (agent ? <PixelAvatar agentId={agent.id} size={20} /> : '●')}
                </div>
                {/* Label */}
                <span style={{ fontSize: 9, color: s.text, fontWeight: 500, letterSpacing: '0.03em', textAlign: 'center' }}>
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{
                  height: 2,
                  flex: '0 0 20px',
                  marginTop: -18,
                  background: isDone
                    ? `${agent?.color ?? '#10b981'}45`
                    : 'rgba(55,65,81,0.3)',
                  borderRadius: 2,
                  transition: 'background 0.5s ease',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
