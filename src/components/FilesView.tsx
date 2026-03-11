'use client'

import { useState } from 'react'

interface FilesViewProps {
  files: Record<string, string>
  isRunning: boolean
  onFileEdit?: (path: string, content: string) => void
}

// Map file extension to display language
function getLangLabel(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    tsx: 'tsx', ts: 'ts', jsx: 'jsx', js: 'js',
    json: 'json', md: 'md', prisma: 'prisma',
    css: 'css', html: 'html', py: 'py', rs: 'rs',
    go: 'go', sol: 'sol', sh: 'sh', env: 'env',
    toml: 'toml', yaml: 'yaml', yml: 'yml',
  }
  return map[ext] ?? ext
}

// Group paths into a folder tree
interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children: TreeNode[]
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const fullPath of paths.sort()) {
    const parts = fullPath.split('/')
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isDir = i < parts.length - 1
      const path = parts.slice(0, i + 1).join('/')
      let node = nodes.find(n => n.name === name && n.isDir === isDir)
      if (!node) {
        node = { name, path, isDir, children: [] }
        nodes.push(node)
        nodes.sort((a, b) => {
          // Directories first, then alphabetical
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      }
      nodes = node.children
    }
  }

  return root
}

interface TreeRowProps {
  node: TreeNode
  depth: number
  selected: string | null
  onSelect: (path: string) => void
  expandedDirs: Set<string>
  toggleDir: (path: string) => void
}

function TreeRow({ node, depth, selected, onSelect, expandedDirs, toggleDir }: TreeRowProps) {
  const isExpanded = expandedDirs.has(node.path)

  if (node.isDir) {
    return (
      <>
        <div
          onClick={() => toggleDir(node.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 12px',
            paddingLeft: 12 + depth * 14,
            cursor: 'pointer',
            fontSize: 11,
            color: '#6b7280',
            userSelect: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(55,65,81,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 9, color: '#4b5563' }}>{isExpanded ? '▼' : '▶'}</span>
          <span>📁</span>
          <span>{node.name}</span>
        </div>
        {isExpanded && node.children.map(child => (
          <TreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
          />
        ))}
      </>
    )
  }

  const ext = node.name.split('.').pop() ?? ''
  const fileIcon = ['tsx', 'ts', 'js', 'jsx'].includes(ext) ? '📄' :
    ['json', 'prisma', 'toml', 'yaml', 'yml'].includes(ext) ? '⚙' :
    ['md', 'txt'].includes(ext) ? '📝' :
    ['sol'].includes(ext) ? '⛓' :
    ext === 'css' ? '🎨' : '📄'

  return (
    <div
      onClick={() => onSelect(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 12px',
        paddingLeft: 12 + depth * 14,
        cursor: 'pointer',
        fontSize: 11,
        color: selected === node.path ? '#e5e7eb' : '#9ca3af',
        background: selected === node.path ? 'rgba(124,110,246,0.12)' : 'transparent',
        borderLeft: selected === node.path ? '2px solid #7c6ef6' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (selected !== node.path) e.currentTarget.style.background = 'rgba(55,65,81,0.2)'
      }}
      onMouseLeave={e => {
        if (selected !== node.path) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ fontSize: 10 }}>{fileIcon}</span>
      <span style={{ fontFamily: '"DM Mono", monospace' }}>{node.name}</span>
      <span style={{
        marginLeft: 'auto',
        fontSize: 9,
        color: '#374151',
        background: 'rgba(55,65,81,0.3)',
        padding: '1px 4px',
        borderRadius: 3,
      }}>
        {getLangLabel(node.path)}
      </span>
    </div>
  )
}

export default function FilesView({ files, isRunning, onFileEdit }: FilesViewProps) {
  const paths = Object.keys(files)
  const [selected, setSelected] = useState<string | null>(paths[0] ?? null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const dirs = new Set<string>()
    for (const p of paths) {
      const parts = p.split('/')
      if (parts.length > 1) dirs.add(parts[0])
    }
    return dirs
  })
  const [isPushing, setIsPushing] = useState(false)
  const [pushStatus, setPushStatus] = useState<{ ok: boolean; msg: string; url?: string } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const tree = buildTree(paths)
  const selectedContent = selected ? files[selected] : null

  const handlePush = async () => {
    if (paths.length === 0) return
    setIsPushing(true)
    setPushStatus(null)
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: paths.map(p => ({ path: p, content: files[p] })),
          message: `feat: push ${paths.length} generated files`,
        }),
      })
      const data = await res.json() as {
        ok: boolean; skipped?: boolean; filesCount?: number
        commitSha?: string; commitUrl?: string; error?: string; isInitialCommit?: boolean
      }
      if (data.ok && !data.skipped) {
        const init = data.isInitialCommit ? ' + scaffolding' : ''
        setPushStatus({ ok: true, msg: `✓ Pushed ${data.filesCount} files${init} · ${data.commitSha}`, url: data.commitUrl })
      } else if (data.skipped) {
        setPushStatus({ ok: false, msg: '⚠ No files to push' })
      } else {
        setPushStatus({ ok: false, msg: `✗ ${data.error}` })
      }
    } catch {
      setPushStatus({ ok: false, msg: '✗ Push failed' })
    } finally {
      setIsPushing(false)
    }
  }

  const startEdit = () => {
    if (!selected) return
    setEditContent(files[selected] ?? '')
    setIsEditing(true)
  }

  const saveEdit = () => {
    if (!selected || !onFileEdit) return
    onFileEdit(selected, editContent)
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  if (paths.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#374151', fontSize: 12,
      }}>
        {isRunning ? '⚙ Generating files…' : 'No files generated yet — run a task to see output files here.'}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* File tree panel */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid rgba(31,41,55,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Tree header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '1px solid rgba(31,41,55,0.4)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 600 }}>
            {paths.length} FILE{paths.length !== 1 ? 'S' : ''}
          </span>
          <button
            onClick={handlePush}
            disabled={isPushing || isRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px',
              background: isPushing ? 'rgba(55,65,81,0.4)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${isPushing ? 'rgba(55,65,81,0.4)' : 'rgba(16,185,129,0.25)'}`,
              borderRadius: 5,
              color: isPushing ? '#4b5563' : '#10b981',
              fontSize: 9.5, fontWeight: 500,
              cursor: isPushing || isRunning ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {isPushing ? '⏳' : '⬆'} Push
          </button>
        </div>

        {/* Push status */}
        {pushStatus && (
          <div style={{
            padding: '4px 12px',
            fontSize: 9.5,
            color: pushStatus.ok ? '#10b981' : '#f59e0b',
            borderBottom: '1px solid rgba(31,41,55,0.3)',
            fontFamily: '"DM Mono", monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>{pushStatus.msg}</span>
            {pushStatus.ok && pushStatus.url && (
              <a
                href={pushStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#a89cf7', textDecoration: 'underline', fontSize: 9.5 }}
              >
                View →
              </a>
            )}
          </div>
        )}

        {/* Tree */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {tree.map(node => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              selected={selected}
              onSelect={setSelected}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          ))}
        </div>
      </div>

      {/* Content panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedContent !== null ? (
          <>
            {/* File header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 14px',
              borderBottom: '1px solid rgba(31,41,55,0.4)',
              flexShrink: 0,
              gap: 8,
            }}>
              <span style={{
                fontSize: 10.5,
                color: '#9ca3af',
                fontFamily: '"DM Mono", monospace',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selected}
              </span>
              <span style={{ fontSize: 9.5, color: '#374151', flexShrink: 0 }}>
                {selectedContent.split('\n').length}L
              </span>
              {/* Edit / Save / Cancel buttons */}
              {!isRunning && onFileEdit && !isEditing && (
                <button
                  onClick={startEdit}
                  style={{
                    padding: '2px 8px', fontSize: 10,
                    background: 'rgba(55,65,81,0.4)',
                    border: '1px solid rgba(55,65,81,0.5)',
                    borderRadius: 5, color: '#9ca3af',
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  Edit
                </button>
              )}
              {isEditing && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={saveEdit}
                    style={{
                      padding: '2px 8px', fontSize: 10,
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: 5, color: '#10b981',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{
                      padding: '2px 8px', fontSize: 10,
                      background: 'rgba(55,65,81,0.3)',
                      border: '1px solid rgba(55,65,81,0.4)',
                      borderRadius: 5, color: '#6b7280',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Code viewer or editor */}
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  flex: 1,
                  margin: 0,
                  padding: '12px 16px',
                  fontSize: 11,
                  lineHeight: 1.65,
                  color: '#d1d5db',
                  fontFamily: '"DM Mono", "Fira Code", monospace',
                  whiteSpace: 'pre',
                  background: 'rgba(5,8,15,0.4)',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  overflowY: 'auto',
                }}
                spellCheck={false}
              />
            ) : (
              <pre style={{
                flex: 1,
                margin: 0,
                padding: '12px 16px',
                fontSize: 11,
                lineHeight: 1.65,
                color: '#d1d5db',
                fontFamily: '"DM Mono", "Fira Code", monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowY: 'auto',
                background: 'transparent',
              }}>
                {selectedContent}
              </pre>
            )}
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#374151', fontSize: 12,
          }}>
            Select a file to view its content
          </div>
        )}
      </div>
    </div>
  )
}
