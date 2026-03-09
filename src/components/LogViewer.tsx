'use client'

import { useEffect, useRef } from 'react'
import type { LogEntry, AgentDef } from '@/types'

interface LogViewerProps {
  logs: LogEntry[]
  agents: AgentDef[]
}

const TYPE_COLORS: Record<string, string> = {
  info: '#60a5fa',
  success: '#10b981',
  error: '#ef4444',
  delegate: '#a78bfa',
  warn: '#f59e0b',
}

const TYPE_BG: Record<string, string> = {
  success: 'rgba(16,185,129,0.03)',
  error: 'rgba(239,68,68,0.04)',
  delegate: 'rgba(167,139,250,0.03)',
  info: 'transparent',
  warn: 'rgba(245,158,11,0.03)',
}

export default function LogViewer({ logs, agents }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '6px 0',
        fontFamily: '"DM Mono", "JetBrains Mono", "Fira Code", monospace',
        fontSize: 11,
        lineHeight: 1.85,
      }}
    >
      {logs.map((log, i) => {
        const agent = agents.find(a => a.id === log.agent)
        const msgColor = TYPE_COLORS[log.type] ?? '#6b7280'
        const rowBg = TYPE_BG[log.type] ?? 'transparent'
        const isLatest = i === logs.length - 1

        return (
          <div
            key={log.id ?? i}
            style={{
              display: 'flex',
              gap: 8,
              padding: '2px 16px',
              borderRadius: 3,
              background: rowBg,
              animation: isLatest ? 'fadeSlideIn 0.3s ease' : undefined,
            }}
          >
            {/* Timestamp */}
            <span style={{ color: '#374151', flexShrink: 0, fontSize: 9.5, minWidth: 64, userSelect: 'none' }}>
              {new Date(log.ts).toLocaleTimeString('en', { hour12: false })}
            </span>

            {/* Agent name */}
            <span style={{
              color: agent?.color ?? '#6b7280',
              fontWeight: 600,
              minWidth: 74,
              flexShrink: 0,
              fontSize: 10,
            }}>
              {agent?.name ?? log.agent}
            </span>

            {/* Message */}
            <span style={{ color: msgColor, wordBreak: 'break-word' }}>
              {log.message}
            </span>
          </div>
        )
      })}
    </div>
  )
}
