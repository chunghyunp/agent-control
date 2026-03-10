import { prisma } from './db'
import { encrypt, decrypt } from './encryption'

export interface AppSettings {
  github: {
    token: string
    owner: string
    repo: string
    branch: string
  }
  anthropic: {
    apiKey: string
    models: {
      supervisor: string
      frontend: string
      backend: string
      web3: string
      reviewer: string
    }
  }
  replicate: {
    token: string
    model: string        // 'flux' | 'sdxl'
    resolution: string   // '512x512' | '1024x1024'
  }
  privy: {
    appId: string
    appSecret: string
    chain: string        // 'bsc-testnet' | 'bsc-mainnet'
  }
  storage: {
    provider: string     // 'local' | 's3' | 'r2'
    bucket: string
    region: string
    accessKey: string
    secretKey: string
    accountId: string    // R2 only
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  github:    { token: '', owner: '', repo: '', branch: 'main' },
  anthropic: {
    apiKey: '',
    models: {
      supervisor: 'claude-sonnet-4-6',
      frontend:   'claude-sonnet-4-6',
      backend:    'claude-sonnet-4-6',
      web3:       'claude-opus-4-6',
      reviewer:   'claude-opus-4-6',
    },
  },
  replicate: { token: '', model: 'flux', resolution: '1024x1024' },
  privy:     { appId: '', appSecret: '', chain: 'bsc-testnet' },
  storage:   { provider: 'local', bucket: '', region: '', accessKey: '', secretKey: '', accountId: '' },
}

/** Load from DB and deep-merge with env var defaults. DB values take priority. */
export async function loadSettings(): Promise<AppSettings> {
  // Start with env var defaults
  const base: AppSettings = {
    ...DEFAULT_SETTINGS,
    anthropic: {
      ...DEFAULT_SETTINGS.anthropic,
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    },
  }

  try {
    const row = await prisma.settings.findUnique({ where: { id: 'default' } })
    if (!row) return base

    const saved = JSON.parse(decrypt(row.data)) as Partial<AppSettings>

    // Deep merge: saved values override base defaults
    return {
      github:    { ...base.github,    ...saved.github },
      anthropic: {
        ...base.anthropic,
        ...saved.anthropic,
        models: { ...base.anthropic.models, ...saved.anthropic?.models },
      },
      replicate: { ...base.replicate, ...saved.replicate },
      privy:     { ...base.privy,     ...saved.privy },
      storage:   { ...base.storage,   ...saved.storage },
    }
  } catch {
    return base
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const encrypted = encrypt(JSON.stringify(settings))
  await prisma.settings.upsert({
    where:  { id: 'default' },
    update: { data: encrypted },
    create: { id: 'default', data: encrypted },
  })
}
