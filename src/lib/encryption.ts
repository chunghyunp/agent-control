import crypto from 'crypto'

// 32-byte key — set SETTINGS_ENCRYPTION_KEY in Railway env vars for production
const KEY = Buffer.alloc(32)
Buffer.from(
  process.env.SETTINGS_ENCRYPTION_KEY ?? 'agent-control-default-key-32char',
  'utf-8'
).copy(KEY)

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':')
}

export function decrypt(encoded: string): string {
  const [ivHex, encHex, tagHex] = encoded.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc).toString('utf-8') + decipher.final('utf-8')
}
