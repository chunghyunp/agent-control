'use client'

import { useState, useRef, useCallback, DragEvent } from 'react'

interface AttachedFile {
  name: string
  content: string
}

interface RepoOverride {
  owner: string
  repo: string
}

interface CommandInputProps {
  onSubmit: (task: string, repoOverride?: RepoOverride) => void
  isRunning: boolean
}

export default function CommandInput({ onSubmit, isRunning }: CommandInputProps) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [repoInput, setRepoInput] = useState('') // "owner/repo" format
  const fileRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const hasContent = !!text.trim() || files.length > 0

  // Read a File object → AttachedFile
  const readFile = (file: File): Promise<AttachedFile> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve({ name: file.name, content: e.target?.result as string })
      reader.onerror = reject
      reader.readAsText(file)
    })

  const addFiles = useCallback(async (incoming: File[]) => {
    const mdFiles = incoming.filter(f => f.name.endsWith('.md') || f.name.endsWith('.txt'))
    if (!mdFiles.length) return
    const read = await Promise.all(mdFiles.map(readFile))
    setFiles(prev => {
      // Deduplicate by filename — replace if same name uploaded again
      const names = new Set(read.map(f => f.name))
      return [...prev.filter(f => !names.has(f.name)), ...read]
    })
  }, [])

  const removeFile = (name: string) =>
    setFiles(prev => prev.filter(f => f.name !== name))

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await addFiles(Array.from(e.target.files))
    e.target.value = '' // reset so same file can be re-added
  }

  // Drag-and-drop handlers
  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setDragging(true)
  }
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  const onDragOver = (e: DragEvent) => e.preventDefault()
  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    if (isRunning) return
    await addFiles(Array.from(e.dataTransfer.files))
  }

  const handleSubmit = () => {
    if (!hasContent || isRunning) return

    const parts: string[] = files.map(f =>
      `=== FILE: ${f.name} ===\n${f.content}\n=== END FILE ===`
    )
    if (text.trim()) parts.push(text.trim())

    // Parse owner/repo override
    let repoOverride: RepoOverride | undefined
    const trimmed = repoInput.trim()
    if (trimmed && trimmed.includes('/')) {
      const [owner, ...rest] = trimmed.split('/')
      const repo = rest.join('/')
      if (owner && repo) repoOverride = { owner, repo }
    }

    onSubmit(parts.join('\n\n'), repoOverride)
    setText('')
    setFiles([])
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: `1px solid ${dragging ? 'rgba(124,110,246,0.6)' : 'rgba(31,41,55,0.6)'}`,
        background: dragging
          ? 'rgba(124,110,246,0.06)'
          : 'rgba(10,12,22,0.6)',
        transition: 'border-color 0.15s, background 0.15s',
        position: 'relative',
      }}
    >
      {/* Drag overlay hint */}
      {dragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          background: 'rgba(124,110,246,0.08)',
          border: '2px dashed rgba(124,110,246,0.5)',
          borderRadius: 2,
        }}>
          <span style={{ fontSize: 13, color: '#a89cf7', fontWeight: 500 }}>
            Drop .md files here
          </span>
        </div>
      )}

      {/* GitHub repo override */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px 0',
      }}>
        <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0, fontWeight: 500 }}>
          📦 Repo:
        </span>
        <input
          value={repoInput}
          onChange={e => setRepoInput(e.target.value)}
          disabled={isRunning}
          placeholder="owner/repo (leave empty for default)"
          style={{
            flex: 1,
            maxWidth: 320,
            background: 'rgba(17,24,39,0.7)',
            border: repoInput.trim()
              ? '1px solid rgba(124,110,246,0.4)'
              : '1px solid rgba(55,65,81,0.5)',
            borderRadius: 8,
            padding: '5px 10px',
            color: '#e5e7eb',
            fontSize: 11.5,
            fontFamily: 'monospace',
            opacity: isRunning ? 0.5 : 1,
            transition: 'border-color 0.2s',
          }}
        />
        {repoInput.trim() && (
          <span style={{ fontSize: 10, color: '#a89cf7', fontStyle: 'italic' }}>
            overrides settings
          </span>
        )}
      </div>

      {/* Attached file badges */}
      {files.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          padding: '8px 16px 0',
        }}>
          {files.map(f => (
            <span key={f.name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(124,110,246,0.12)',
              border: '1px solid rgba(124,110,246,0.3)',
              borderRadius: 6,
              padding: '2px 6px 2px 8px',
              fontSize: 11,
              color: '#a89cf7',
              maxWidth: 220,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📄 {f.name}
              </span>
              <button
                onClick={() => removeFile(f.name)}
                title="Remove"
                style={{
                  background: 'none', border: 'none',
                  color: '#6b7280', cursor: 'pointer',
                  padding: '0 2px', fontSize: 13, lineHeight: 1,
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '13px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 8px', color: '#7c6ef6',
          fontSize: 12, fontWeight: 600,
          flexShrink: 0,
          opacity: isRunning ? 0.5 : 1,
        }}>
          🧠 →
        </div>

        {/* Hidden multi-file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          multiple
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isRunning}
          title="Attach .md files (multiple allowed)"
          style={{
            background: files.length > 0
              ? 'rgba(124,110,246,0.15)'
              : 'rgba(17,24,39,0.7)',
            border: files.length > 0
              ? '1px solid rgba(124,110,246,0.4)'
              : '1px solid rgba(55,65,81,0.5)',
            borderRadius: 10,
            padding: '0 12px',
            color: files.length > 0 ? '#a89cf7' : isRunning ? '#4b5563' : '#6b7280',
            fontSize: 15,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 5,
            flexShrink: 0, height: 38, position: 'relative',
          }}
        >
          📎
          {files.length > 0 && (
            <span style={{
              fontSize: 9.5, fontWeight: 700,
              background: '#7c6ef6',
              color: 'white',
              borderRadius: 8,
              padding: '1px 5px',
              lineHeight: 1.4,
            }}>{files.length}</span>
          )}
        </button>

        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          disabled={isRunning}
          placeholder={
            isRunning
              ? 'Agents working — please wait...'
              : files.length > 0
              ? 'Add instructions (optional)...'
              : 'Describe what to build... or drag .md files here'
          }
          style={{
            flex: 1,
            background: 'rgba(17,24,39,0.7)',
            border: '1px solid rgba(55,65,81,0.5)',
            borderRadius: 10,
            padding: '10px 14px',
            color: '#e5e7eb',
            fontSize: 12.5,
            fontFamily: 'inherit',
            opacity: isRunning ? 0.5 : 1,
            transition: 'border-color 0.2s, opacity 0.2s',
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={isRunning || !hasContent}
          style={{
            background: isRunning || !hasContent
              ? 'rgba(55,65,81,0.4)'
              : 'linear-gradient(135deg, #7c6ef6, #6358d4)',
            border: 'none', borderRadius: 10,
            padding: '0 22px',
            color: isRunning || !hasContent ? '#6b7280' : 'white',
            fontWeight: 600, fontSize: 12,
            cursor: isRunning || !hasContent ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit', letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {isRunning ? (
            <>
              <div style={{
                width: 12, height: 12,
                border: '2px solid rgba(107,114,128,0.5)',
                borderTopColor: '#9ca3af',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Running...
            </>
          ) : 'Execute'}
        </button>
      </div>
    </div>
  )
}
