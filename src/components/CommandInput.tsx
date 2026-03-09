'use client'

import { useState, useRef } from 'react'

interface CommandInputProps {
  onSubmit: (task: string) => void
  isRunning: boolean
}

export default function CommandInput({ onSubmit, isRunning }: CommandInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (!value.trim() || isRunning) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      padding: '13px 16px',
      borderTop: '1px solid rgba(31,41,55,0.6)',
      background: 'rgba(10,12,22,0.6)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 8px',
        color: '#7c6ef6',
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
        opacity: isRunning ? 0.5 : 1,
      }}>
        🧠 →
      </div>

      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
        disabled={isRunning}
        placeholder={isRunning ? 'Agents working — please wait...' : 'Describe what to build...'}
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
        disabled={isRunning || !value.trim()}
        style={{
          background: isRunning || !value.trim()
            ? 'rgba(55,65,81,0.4)'
            : 'linear-gradient(135deg, #7c6ef6, #6358d4)',
          border: 'none',
          borderRadius: 10,
          padding: '0 22px',
          color: isRunning || !value.trim() ? '#6b7280' : 'white',
          fontWeight: 600,
          fontSize: 12,
          cursor: isRunning ? 'not-allowed' : !value.trim() ? 'not-allowed' : 'pointer',
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
  )
}
