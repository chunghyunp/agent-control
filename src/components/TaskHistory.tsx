'use client'

import { useState, useEffect } from 'react'
import type { Task, TaskFile } from '@/types'

interface TaskDetail {
  logs?: Array<{ agent: string; type: string; message: string; createdAt: string }>
  costs?: Array<{ agent: string; inputTokens: number; outputTokens: number; costUsd: number }>
  files?: TaskFile[]
}

interface TaskHistoryProps {
  tasks: Task[]
  onLoadFiles?: (taskId: string) => void
  onDelete?: (taskId: string) => void
  onRerun?: (title: string) => void
  showGithubLinks?: boolean
}

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'rgba(124,110,246,0.1)', text: '#a78bfa', dot: '#7c6ef6' },
  completed: { bg: 'rgba(16,185,129,0.08)', text: '#34d399', dot: '#10b981' },
  error: { bg: 'rgba(239,68,68,0.08)', text: '#f87171', dot: '#ef4444' },
  pending: { bg: 'rgba(55,65,81,0.3)', text: '#6b7280', dot: '#374151' },
}

const BTN: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid rgba(55,65,81,0.5)',
  background: 'rgba(31,41,55,0.4)',
  color: '#9ca3af',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.15s',
}

const PILL: React.CSSProperties = {
  fontSize: 9,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(55,65,81,0.3)',
  color: '#6b7280',
  fontFamily: '"DM Mono", monospace',
}

export default function TaskHistory({ tasks, onLoadFiles, onDelete, onRerun, showGithubLinks }: TaskHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, TaskDetail>>({})

  // Fetch task details when expanded
  useEffect(() => {
    if (!expanded || details[expanded]) return
    fetch('/api/tasks/' + expanded)
      .then(r => r.json())
      .then((data: TaskDetail) => {
        setDetails(prev => ({ ...prev, [expanded]: data }))
      })
      .catch(() => null)
  }, [expanded, details])

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '100%', padding: '6px 8px' }}>
      {tasks.map(t => {
        const sc = STATUS_COLOR[t.status] ?? STATUS_COLOR.pending
        const isExpanded = expanded === t.id
        const detail = details[t.id]

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: sc.dot,
                  animation: t.status === 'active' ? 'blink 1.5s infinite' : undefined,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize: 9.5, color: '#4b5563', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{t.created}</span>
                    {t.repoTarget && <span style={PILL}>{t.repoTarget}</span>}
                    {t.totalCost != null && t.totalCost > 0 && <span style={PILL}>${t.totalCost.toFixed(3)}</span>}
                    {t.agentCount != null && t.agentCount > 0 && <span style={PILL}>{t.agentCount} agents</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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

            {isExpanded && (
              <div style={{
                margin: '4px 0 4px 20px',
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(13,17,23,0.8)',
                border: '1px solid rgba(31,41,55,0.6)',
              }}>
                {/* Result */}
                {t.result && (
                  <div style={{
                    fontSize: 11,
                    color: '#9ca3af',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 120,
                    overflowY: 'auto',
                    fontFamily: '"DM Mono", monospace',
                    marginBottom: 10,
                  }}>
                    {t.result}
                  </div>
                )}

                {/* Cost breakdown */}
                {detail?.costs && detail.costs.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Breakdown</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {detail.costs.map((c, i) => (
                        <span key={i} style={{
                          fontSize: 9.5,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(55,65,81,0.3)',
                          color: '#9ca3af',
                          fontFamily: '"DM Mono", monospace',
                        }}>
                          {c.agent}: ${c.costUsd.toFixed(4)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Committed files */}
                {detail?.files && detail.files.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Files ({detail.files.length})
                    </div>
                    <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {detail.files.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                          <span style={{ color: '#9ca3af', fontFamily: '"DM Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.path}
                          </span>
                          {f.agentName && (
                            <span style={{ ...PILL, fontSize: 8.5 }}>{f.agentName}</span>
                          )}
                          {showGithubLinks && f.githubUrl && (
                            <a
                              href={f.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ color: '#7c6ef6', fontSize: 9, textDecoration: 'none', flexShrink: 0 }}
                            >
                              GitHub ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(t.status === 'completed' || t.status === 'error') && onLoadFiles && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLoading(t.id)
                        onLoadFiles(t.id)
                        setTimeout(() => setLoading(null), 1500)
                      }}
                      style={{
                        ...BTN,
                        background: loading === t.id ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
                        borderColor: 'rgba(16,185,129,0.3)',
                        color: '#34d399',
                      }}
                    >
                      {loading === t.id ? '✓ Loaded' : '↓ Load Files'}
                    </button>
                  )}
                  {showGithubLinks && t.branch && t.repoTarget && (
                    <a
                      href={`https://github.com/${t.repoTarget}/tree/${t.branch}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        ...BTN,
                        background: 'rgba(55,65,81,0.3)',
                        borderColor: 'rgba(55,65,81,0.5)',
                        color: '#d1d5db',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      View on GitHub ↗
                    </a>
                  )}
                  {onRerun && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRerun(t.title) }}
                      style={{
                        ...BTN,
                        background: 'rgba(124,110,246,0.08)',
                        borderColor: 'rgba(124,110,246,0.3)',
                        color: '#a78bfa',
                      }}
                    >
                      ↻ Re-run
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this task and all its data?')) onDelete(t.id)
                      }}
                      style={{
                        ...BTN,
                        background: 'rgba(239,68,68,0.06)',
                        borderColor: 'rgba(239,68,68,0.2)',
                        color: '#f87171',
                      }}
                    >
                      ✕ Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
