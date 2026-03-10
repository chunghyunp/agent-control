'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { AppSettings } from '@/lib/settings-store'

// ─── helpers ────────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { value: 'claude-opus-4-6',   label: 'Opus 4.6' },
]

function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => { setToken(localStorage.getItem('settings_token')) }, [])
  const login = (t: string) => { localStorage.setItem('settings_token', t); setToken(t) }
  const logout = () => { localStorage.removeItem('settings_token'); setToken(null) }
  return { token, login, logout }
}

// ─── sub-components ─────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', placeholder = '', disabled = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          background: disabled ? 'rgba(17,24,39,0.3)' : 'rgba(17,24,39,0.8)',
          border: '1px solid rgba(55,65,81,0.6)',
          borderRadius: 8,
          padding: '9px 12px',
          color: disabled ? '#4b5563' : '#e5e7eb',
          fontSize: 12.5,
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function Select({
  label, value, onChange, options, disabled = false,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          background: 'rgba(17,24,39,0.8)',
          border: '1px solid rgba(55,65,81,0.6)',
          borderRadius: 8,
          padding: '9px 12px',
          color: '#e5e7eb',
          fontSize: 12.5,
          fontFamily: 'inherit',
          width: '100%',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function TestButton({
  onClick, loading, result,
}: {
  onClick: () => void; loading: boolean; result: { ok: boolean; message: string; detail?: string } | null
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
      <button
        onClick={onClick}
        disabled={loading}
        style={{
          background: 'rgba(124,110,246,0.1)',
          border: '1px solid rgba(124,110,246,0.3)',
          borderRadius: 8,
          padding: '7px 16px',
          color: loading ? '#6b7280' : '#a89cf7',
          fontSize: 11.5,
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Testing…' : 'Test Connection'}
      </button>
      {result && (
        <span style={{
          fontSize: 11.5,
          color: result.ok ? '#10b981' : '#ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          {result.ok ? '✓' : '✗'} {result.message}
          {result.detail && <span style={{ color: '#6b7280' }}>— {result.detail}</span>}
        </span>
      )}
    </div>
  )
}

function SectionCard({
  id, icon, title, open, onToggle, disabled, children,
}: {
  id: string; icon: string; title: string; open: boolean; onToggle: () => void
  disabled?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      border: `1px solid ${disabled ? 'rgba(55,65,81,0.3)' : 'rgba(55,65,81,0.5)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      opacity: disabled ? 0.5 : 1,
    }}>
      <button
        onClick={disabled ? undefined : onToggle}
        style={{
          width: '100%',
          background: open ? 'rgba(124,110,246,0.07)' : 'rgba(17,24,39,0.5)',
          border: 'none',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: disabled ? '#4b5563' : '#e5e7eb' }}>
            {title}
          </span>
          {disabled && (
            <span style={{
              fontSize: 9.5, fontWeight: 600,
              background: 'rgba(55,65,81,0.4)',
              color: '#6b7280',
              padding: '2px 7px',
              borderRadius: 4,
              letterSpacing: '0.06em',
            }}>PHASE 2</span>
          )}
        </div>
        {!disabled && (
          <span style={{ color: '#6b7280', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
        )}
      </button>
      {open && !disabled && (
        <div style={{
          padding: '20px 18px',
          background: 'rgba(10,12,22,0.4)',
          borderTop: '1px solid rgba(55,65,81,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── password gate ───────────────────────────────────────────────────────────

function PasswordGate({ onLogin }: { onLogin: (token: string) => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    setError('')
    const res = await fetch('/api/settings/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    setLoading(false)
    if (res.ok) {
      onLogin(pw)
    } else {
      setError('Wrong password')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0c16', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(17,24,39,0.6)',
        border: '1px solid rgba(55,65,81,0.5)',
        borderRadius: 16, padding: '36px 40px', width: 320,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>Settings</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Enter dashboard password</div>
        </div>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Password"
          autoFocus
          style={{
            background: 'rgba(17,24,39,0.8)',
            border: `1px solid ${error ? '#ef4444' : 'rgba(55,65,81,0.6)'}`,
            borderRadius: 8, padding: '10px 14px',
            color: '#e5e7eb', fontSize: 13, fontFamily: 'inherit', width: '100%',
            boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
        <button
          onClick={submit}
          disabled={loading || !pw}
          style={{
            background: 'linear-gradient(135deg, #7c6ef6, #6358d4)',
            border: 'none', borderRadius: 8, padding: '11px',
            color: 'white', fontWeight: 600, fontSize: 13,
            cursor: loading || !pw ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: loading || !pw ? 0.6 : 1,
          }}
        >
          {loading ? 'Checking…' : 'Enter'}
        </button>
        <Link href="/" style={{ fontSize: 11.5, color: '#4b5563', textAlign: 'center' }}>
          ← Back to dashboard
        </Link>
      </div>
    </div>
  )
}

// ─── main settings form ──────────────────────────────────────────────────────

type TestResult = { ok: boolean; message: string; detail?: string } | null

export default function SettingsPage() {
  const { token, login, logout } = useAuth()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['github']))
  const [testing, setTesting]     = useState<Record<string, boolean>>({})
  const [results,  setResults]    = useState<Record<string, TestResult>>({})
  const [saving,   setSaving]     = useState(false)
  const [toast,    setToast]      = useState<{ message: string; ok: boolean } | null>(null)

  const authHeader = { Authorization: `Bearer ${token ?? ''}` }

  // Load settings from DB once authenticated
  useEffect(() => {
    if (!token) return
    fetch('/api/settings', { headers: authHeader })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const set = useCallback(<K extends keyof AppSettings>(
    section: K,
    field: keyof AppSettings[K],
    value: string
  ) => {
    setSettings(prev => {
      if (!prev) return prev
      return { ...prev, [section]: { ...prev[section], [field]: value } }
    })
  }, [])

  const setModel = useCallback((agent: keyof AppSettings['anthropic']['models'], value: string) => {
    setSettings(prev => {
      if (!prev) return prev
      return { ...prev, anthropic: { ...prev.anthropic, models: { ...prev.anthropic.models, [agent]: value } } }
    })
  }, [])

  const toggleSection = (id: string) =>
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const showToast = (message: string, ok: boolean) => {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const saveAll = async () => {
    if (!settings) return
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    showToast(res.ok ? 'Settings saved' : 'Save failed', res.ok)
  }

  const testConnection = async (provider: string, extra: object = {}) => {
    if (!settings) return
    setTesting(t => ({ ...t, [provider]: true }))
    setResults(r => ({ ...r, [provider]: null }))

    const credMap: Record<string, object> = {
      github:    { token: settings.github.token, owner: settings.github.owner, repo: settings.github.repo },
      anthropic: { apiKey: settings.anthropic.apiKey },
      replicate: { token: settings.replicate.token },
      privy:     { appId: settings.privy.appId, appSecret: settings.privy.appSecret },
      storage: {
        provider: settings.storage.provider,
        bucket:    settings.storage.bucket,
        region:    settings.storage.region,
        accessKey: settings.storage.accessKey,
        secretKey: settings.storage.secretKey,
        accountId: settings.storage.accountId,
      },
    }

    const res = await fetch('/api/settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ provider, ...credMap[provider], ...extra }),
    })
    const data = await res.json()
    setResults(r => ({ ...r, [provider]: data }))
    setTesting(t => ({ ...t, [provider]: false }))
  }

  if (!token) return <PasswordGate onLogin={login} />
  if (!settings) return (
    <div style={{ minHeight: '100vh', background: '#0a0c16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>Loading settings…</span>
    </div>
  )

  const s = settings

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c16', color: '#e5e7eb', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Glow */}
      <div style={{ position: 'fixed', top: -300, right: -200, width: 700, height: 700, background: 'radial-gradient(circle, rgba(124,110,246,0.04) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 24px 60px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid rgba(31,41,55,0.6)', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{ color: '#4b5563', fontSize: 13, textDecoration: 'none' }}>← Dashboard</Link>
            <span style={{ color: '#1f2937' }}>|</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>Settings</span>
          </div>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Log out
          </button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── GitHub ── */}
          <SectionCard id="github" icon="🐙" title="GitHub Integration" open={openSections.has('github')} onToggle={() => toggleSection('github')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="GitHub Token" value={s.github.token} onChange={v => set('github', 'token', v)} type="password" placeholder="ghp_..." />
              </div>
              <Field label="Repo Owner" value={s.github.owner} onChange={v => set('github', 'owner', v)} placeholder="your-username" />
              <Field label="Repo Name"  value={s.github.repo}  onChange={v => set('github', 'repo', v)}  placeholder="my-repo" />
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Branch" value={s.github.branch} onChange={v => set('github', 'branch', v)} placeholder="main" />
              </div>
            </div>
            <TestButton onClick={() => testConnection('github')} loading={!!testing.github} result={results.github ?? null} />
          </SectionCard>

          {/* ── Anthropic ── */}
          <SectionCard id="anthropic" icon="🧠" title="AI Provider (Anthropic)" open={openSections.has('anthropic')} onToggle={() => toggleSection('anthropic')}>
            <Field label="Anthropic API Key" value={s.anthropic.apiKey} onChange={v => set('anthropic', 'apiKey', v)} type="password" placeholder="sk-ant-api03-..." />
            <div style={{ borderTop: '1px solid rgba(55,65,81,0.3)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, fontWeight: 500 }}>Model per agent</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(Object.keys(s.anthropic.models) as (keyof AppSettings['anthropic']['models'])[]).map(agent => (
                  <Select
                    key={agent}
                    label={agent.charAt(0).toUpperCase() + agent.slice(1)}
                    value={s.anthropic.models[agent]}
                    onChange={v => setModel(agent, v)}
                    options={MODEL_OPTIONS}
                  />
                ))}
              </div>
            </div>
            <TestButton onClick={() => testConnection('anthropic')} loading={!!testing.anthropic} result={results.anthropic ?? null} />
          </SectionCard>

          {/* ── Replicate ── */}
          <SectionCard id="replicate" icon="🎨" title="Image Generation (Replicate)" open={openSections.has('replicate')} onToggle={() => toggleSection('replicate')}>
            <Field label="Replicate API Token" value={s.replicate.token} onChange={v => set('replicate', 'token', v)} type="password" placeholder="r8_..." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="Model"
                value={s.replicate.model}
                onChange={v => set('replicate', 'model', v)}
                options={[{ value: 'flux', label: 'FLUX' }, { value: 'sdxl', label: 'SDXL' }]}
              />
              <Select
                label="Output Resolution"
                value={s.replicate.resolution}
                onChange={v => set('replicate', 'resolution', v)}
                options={[{ value: '512x512', label: '512 × 512' }, { value: '1024x1024', label: '1024 × 1024' }]}
              />
            </div>
            <TestButton onClick={() => testConnection('replicate')} loading={!!testing.replicate} result={results.replicate ?? null} />
          </SectionCard>

          {/* ── Privy ── */}
          <SectionCard id="privy" icon="🔐" title="Wallet Auth (Privy)" open={openSections.has('privy')} onToggle={() => toggleSection('privy')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Privy App ID"     value={s.privy.appId}     onChange={v => set('privy', 'appId', v)}     placeholder="clxxxxxx" />
              <Field label="Privy App Secret" value={s.privy.appSecret} onChange={v => set('privy', 'appSecret', v)} type="password" placeholder="••••••••" />
            </div>
            <Select
              label="Chain"
              value={s.privy.chain}
              onChange={v => set('privy', 'chain', v)}
              options={[{ value: 'bsc-testnet', label: 'BSC Testnet' }, { value: 'bsc-mainnet', label: 'BSC Mainnet' }]}
            />
            <TestButton onClick={() => testConnection('privy')} loading={!!testing.privy} result={results.privy ?? null} />
          </SectionCard>

          {/* ── Storage ── */}
          <SectionCard id="storage" icon="🗄️" title="Image Storage" open={openSections.has('storage')} onToggle={() => toggleSection('storage')}>
            <Select
              label="Provider"
              value={s.storage.provider}
              onChange={v => set('storage', 'provider', v)}
              options={[
                { value: 'local', label: 'Local (temporary)' },
                { value: 's3',    label: 'AWS S3' },
                { value: 'r2',    label: 'Cloudflare R2' },
              ]}
            />
            {s.storage.provider !== 'local' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Bucket"     value={s.storage.bucket}    onChange={v => set('storage', 'bucket', v)}    placeholder="my-bucket" />
                  {s.storage.provider === 's3' && (
                    <Field label="Region"   value={s.storage.region}    onChange={v => set('storage', 'region', v)}    placeholder="us-east-1" />
                  )}
                  {s.storage.provider === 'r2' && (
                    <Field label="Account ID" value={s.storage.accountId} onChange={v => set('storage', 'accountId', v)} placeholder="abc123..." />
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Access Key" value={s.storage.accessKey} onChange={v => set('storage', 'accessKey', v)} placeholder="AKIA..." />
                  <Field label="Secret Key" value={s.storage.secretKey} onChange={v => set('storage', 'secretKey', v)} type="password" placeholder="••••••••" />
                </div>
              </div>
            )}
            <TestButton onClick={() => testConnection('storage')} loading={!!testing.storage} result={results.storage ?? null} />
          </SectionCard>

          {/* ── LINE / Unifi — Phase 2 ── */}
          <SectionCard id="unifi" icon="📡" title="LINE / Unifi (Kaia Chain)" open={false} onToggle={() => {}} disabled>
            <div />
          </SectionCard>

        </div>

        {/* Save All */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={saveAll}
            disabled={saving}
            style={{
              background: saving ? 'rgba(55,65,81,0.4)' : 'linear-gradient(135deg, #7c6ef6, #6358d4)',
              border: 'none', borderRadius: 10, padding: '11px 32px',
              color: saving ? '#6b7280' : 'white',
              fontWeight: 600, fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', letterSpacing: '0.02em',
            }}
          >
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: 10, padding: '12px 20px',
          color: toast.ok ? '#10b981' : '#ef4444',
          fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.ok ? '✓' : '✗'} {toast.message}
        </div>
      )}
    </div>
  )
}
