'use client'

import { useState, useEffect, useRef } from 'react'
import type { LogEntry, AgentDef } from '@/types'

interface LogViewerProps {
  logs: LogEntry[]
  agents: AgentDef[]
}

const TYPE_COLOR: Record<string, string> = {
  info:     '#4b5563',
  success:  '#10b981',
  error:    '#ef4444',
  delegate: '#a78bfa',
  warn:     '#f59e0b',
}

const TYPE_ICON: Record<string, string> = {
  success:  '✓',
  error:    '✗',
  warn:     '⚠',
  delegate: '→',
  info:     '·',
}

/** In summary mode, only show "important" log lines */
function isSummaryLine(log: LogEntry): boolean {
  if (log.type !== 'info') return true
  const m = log.message.toLowerCase()
  return (
    m.includes('delegat') ||
    m.includes('complete') ||
    m.includes('push') ||
    m.includes('railway') ||
    m.includes('retry') ||
    m.includes('task') ||
    m.includes('start') ||
    m.includes('…') ||
    m.includes('...')
  )
}

export default function LogViewer({ logs, agents }: LogViewerProps) {
  const [showAll, setShowAll] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, showAll])

  const filtered = showAll ? logs : logs.filter(isSummaryLine)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '3px 16px',
        borderBottom: '1px solid rgba(31,41,55,0.35)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9.5, color: '#374151' }}>
          {filtered.length}{showAll ? '' : `/${logs.length}`} events
        </span>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            fontSize: 10,
            color: '#4b5563',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            fontFamily: 'inherit',
          }}
        >
          {showAll ? '◀ Summary' : 'All logs ▶'}
        </button>
      </div>

      {/* Log rows */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
          fontFamily: '"DM Mono", "JetBrains Mono", "Fira Code", monospace',
          fontSize: 11,
          lineHeight: 1.8,
        }}
      >
        {filtered.map((log, i) => {
          const agent = agents.find(a => a.id === log.agent)
          const color = TYPE_COLOR[log.type] ?? '#6b7280'
          const icon = TYPE_ICON[log.type] ?? '·'
          const isLatest = i === filtered.length - 1

          return (
            <div
              key={log.id ?? i}
              style={{
                display: 'flex',
                gap: 8,
                padding: '1px 16px',
                animation: isLatest ? 'fadeSlideIn 0.25s ease' : undefined,
              }}
            >
              {/* Timestamp */}
              <span style={{
                color: '#2d3748',
                flexShrink: 0,
                fontSize: 9.5,
                minWidth: 64,
                userSelect: 'none',
              }}>
                {new Date(log.ts).toLocaleTimeString('en', { hour12: false })}
              </span>

              {/* Icon */}
              <span style={{ color, flexShrink: 0, minWidth: 10, userSelect: 'none' }}>
                {icon}
              </span>

              {/* Agent */}
              <span style={{
                color: agent?.color ?? '#6b7280',
                fontWeight: 600,
                flexShrink: 0,
                minWidth: 72,
                fontSize: 10,
              }}>
                {agent?.name ?? log.agent}
              </span>

              {/* Message */}
              <span style={{ color, wordBreak: 'break-word' }}>
                {log.message}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
