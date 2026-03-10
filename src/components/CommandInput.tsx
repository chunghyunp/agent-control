'use client'

import { useState, useRef } from 'react'

interface CommandInputProps {
  onSubmit: (task: string) => void
  isRunning: boolean
}

export default function CommandInput({ onSubmit, isRunning }: CommandInputProps) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const hasContent = !!text.trim() || !!fileContent

  const handleSubmit = () => {
    if (!hasContent || isRunning) return

    let message: string
    if (fileContent && text.trim()) {
      message = `${fileContent}\n---\n${text.trim()}`
    } else if (fileContent) {
      message = fileContent
    } else {
      message = text.trim()
    }

    onSubmit(message)
    setText('')
    setFileName(null)
    setFileContent(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setFileContent(ev.target?.result as string)
      setFileName(file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const removeFile = () => {
    setFileName(null)
    setFileContent(null)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderTop: '1px solid rgba(31,41,55,0.6)',
      background: 'rgba(10,12,22,0.6)',
    }}>
      {/* File attachment badge */}
      {fileName && (
        <div style={{ padding: '7px 16px 0' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(124,110,246,0.12)',
            border: '1px solid rgba(124,110,246,0.3)',
            borderRadius: 6,
            padding: '2px 6px 2px 8px',
            fontSize: 11,
            color: '#a89cf7',
          }}>
            📄 {fileName}
            <button
              onClick={removeFile}
              title="Remove file"
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: 13,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >×</button>
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '13px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          color: '#7c6ef6',
          fontSize: 12,
          fontWeight: 600,
          flexShrink: 0,
          opacity: isRunning ? 0.5 : 1,
        }}>
          🧠 →
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isRunning}
          title="Attach .md spec file"
          style={{
            background: fileName
              ? 'rgba(124,110,246,0.15)'
              : 'rgba(17,24,39,0.7)',
            border: fileName
              ? '1px solid rgba(124,110,246,0.4)'
              : '1px solid rgba(55,65,81,0.5)',
            borderRadius: 10,
            padding: '0 12px',
            color: fileName ? '#a89cf7' : isRunning ? '#4b5563' : '#6b7280',
            fontSize: 15,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            height: 38,
          }}
        >
          📎
        </button>

        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          disabled={isRunning}
          placeholder={
            isRunning
              ? 'Agents working — please wait...'
              : fileName
              ? 'Add instructions (optional)...'
              : 'Describe what to build...'
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
            border: 'none',
            borderRadius: 10,
            padding: '0 22px',
            color: isRunning || !hasContent ? '#6b7280' : 'white',
            fontWeight: 600,
            fontSize: 12,
            cursor: isRunning || !hasContent ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isRunning ? (
            <>
              <div style={{
                width: 12,
                height: 12,
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
