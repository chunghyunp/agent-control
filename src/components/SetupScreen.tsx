'use client'

import { useState } from 'react'

interface SetupScreenProps {
  onConnect: (apiKey: string) => void
}

export default function SetupScreen({ onConnect }: SetupScreenProps) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)

  const handleConnect = async () => {
    if (!key.trim()) return
    setTesting(true)
    setError('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      if (res.ok) {
        onConnect(key.trim())
      } else {
        const data = await res.json()
        setError((data as { error?: { message?: string } }).error?.message || 'Invalid API key')
      }
    } catch {
      setError('Network error — check your connection')
    }
    setTesting(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c16',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,18,30,0.97), rgba(20,24,40,0.92))',
        border: '1px solid rgba(120,140,170,0.1)',
        borderRadius: 20,
        padding: '44px 40px',
        width: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Logo + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            background: 'linear-gradient(135deg, #7c6ef6, #b38cfa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: 'white',
            flexShrink: 0,
          }}>◈</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e5e7eb', letterSpacing: '-0.025em' }}>
              Agent Control
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
              Connect your Anthropic API key
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.75, marginBottom: 24 }}>
          This dashboard orchestrates 5 AI agents via the Anthropic API directly from
          your browser. Your key is stored in memory for this session only — never
          persisted to disk or sent to any third-party server.
        </div>

        {/* Agents info */}
        <div style={{
          background: 'rgba(124,110,246,0.06)',
          border: '1px solid rgba(124,110,246,0.12)',
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 11,
          color: '#7c6ef6',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>5 Agents Standing By</div>
          <div style={{ color: '#6b7280' }}>Supervisor · Frontend · Backend · Web3 · Reviewer</div>
          <div style={{ color: '#4b5563', fontSize: 10 }}>claude-sonnet-4-6 + claude-opus-4-6</div>
        </div>

        {/* Input */}
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          placeholder="sk-ant-api03-..."
          style={{
            width: '100%',
            background: 'rgba(10,12,22,0.7)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(120,140,170,0.12)'}`,
            borderRadius: 10,
            padding: '13px 16px',
            color: '#e5e7eb',
            fontSize: 13,
            fontFamily: '"DM Mono", monospace',
            outline: 'none',
            marginBottom: error ? 8 : 14,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
        />

        {error && (
          <div style={{ fontSize: 11.5, color: '#ef4444', marginBottom: 14, paddingLeft: 2 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={testing || !key.trim()}
          style={{
            width: '100%',
            padding: '13px 0',
            background: testing || !key.trim()
              ? 'rgba(60,64,80,0.6)'
              : 'linear-gradient(135deg, #7c6ef6, #6358d4)',
            border: 'none',
            borderRadius: 10,
            color: testing || !key.trim() ? '#6b7280' : 'white',
            fontWeight: 600,
            fontSize: 13.5,
            cursor: testing ? 'wait' : !key.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.015em',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {testing ? (
            <>
              <div style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Verifying...
            </>
          ) : 'Connect & Launch'}
        </button>

        <div style={{ fontSize: 10, color: '#374151', marginTop: 18, textAlign: 'center', lineHeight: 1.7 }}>
          API calls are made directly from your browser to api.anthropic.com<br />
          Socket.io is used for real-time updates between browser tabs
        </div>
      </div>
    </div>
  )
}
