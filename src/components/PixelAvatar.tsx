'use client'

/**
 * CSS pixel art avatars for each agent.
 * Uses a 1px element with box-shadow to draw each pixel.
 * Each sprite is designed on an ~12x14 grid, rendered at 3x scale = ~36x42px.
 */

const S = 3 // scale factor (px per pixel)

// Helper: convert pixel grid data to box-shadow string
// Each row is a string where characters map to palette colors, '.' = transparent
function spriteToShadow(rows: string[], palette: Record<string, string>): string {
  const shadows: string[] = []
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x]
      if (ch === '.' || ch === ' ') continue
      const color = palette[ch]
      if (!color) continue
      shadows.push(`${(x + 1) * S}px ${(y + 1) * S}px 0 ${color}`)
    }
  }
  return shadows.join(',')
}

// ── Sprite Data ────────────────────────────────────────────────────

const SPRITES: Record<string, { rows: string[]; palette: Record<string, string> }> = {
  orchestrator: {
    palette: { a: '#7c6ef6', b: '#5b4fd4', c: '#d1d5db', d: '#1f2937', e: '#a78bfa', f: '#4c1d95' },
    rows: [
      '....aaaa....',
      '...aaaaaa...',
      '..aeaeaeae..',
      '..aaaaaaaa..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbbbbbb..',
      '.bbbbbabbbb.',
      '.bb.bbbb.bb.',
      '.bb.bffb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  architect: {
    palette: { a: '#6366f1', b: '#4f46e5', c: '#d1d5db', d: '#1f2937', e: '#818cf8', f: '#312e81' },
    rows: [
      '....ffff....',
      '...ffffff...',
      '...faaaaf...',
      '..ffffffff..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbbbbbb..',
      '.bbbebbebb..',
      '.bb.bbbb.bb.',
      '.bb.bbbb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  'ux-researcher': {
    palette: { a: '#ec4899', b: '#be185d', c: '#d1d5db', d: '#1f2937', e: '#f9a8d4', f: '#831843' },
    rows: [
      '...eeeeee...',
      '..eeeeeeee..',
      '..eaaeaaee..',
      '..eeeeeeee..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcaacd...',
      '....dccd....',
      '...bbbbbb...',
      '..bbbbbbbb..',
      '.bb..bb..bb.',
      '.bb.bbbb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  'ui-designer': {
    palette: { a: '#f472b6', b: '#db2777', c: '#d1d5db', d: '#1f2937', e: '#fbcfe8', f: '#9d174d' },
    rows: [
      '....aaaa....',
      '...aaeaaa...',
      '..aaaaaaaa..',
      '..aaaaaaaa..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbabbbb..',
      '.bbbbbbbbb..',
      '.bb.bffb.bb.',
      '.bb.bbbb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  'brand-guardian': {
    palette: { a: '#f9a8d4', b: '#ec4899', c: '#d1d5db', d: '#1f2937', e: '#fce7f3', f: '#be185d' },
    rows: [
      '..aaaaaaaa..',
      '.aaaaaaaaaa.',
      '.aaeaaeaaaa.',
      '.aaaaaaaaaa.',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..ffbbbbff..',
      '.ffffbbffff.',
      '.ff.ffff.ff.',
      '.ff.ffff.ff.',
      '....ffff....',
      '...dd..dd...',
    ],
  },
  frontend: {
    palette: { a: '#e8608c', b: '#be185d', c: '#d1d5db', d: '#1f2937', e: '#fda4af', f: '#881337' },
    rows: [
      '....aaaa....',
      '...aaaaaa...',
      '..aaaaaaaa..',
      '..aaaaaaaa..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..aabbbbaa..',
      '.aaabbbbbbaa',
      '.aa.abba.aa.',
      '.aa.bbbb.aa.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  backend: {
    palette: { a: '#2dd4a8', b: '#059669', c: '#d1d5db', d: '#1f2937', e: '#6ee7b7', f: '#064e3b' },
    rows: [
      '....aaaa....',
      '...aaeaaa...',
      '..aaaaaaaa..',
      '..aaaeaaaa..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbbbbbb..',
      '.bbbbabbbbb.',
      '.bb.bbbb.bb.',
      '.bb.bffb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  web3: {
    palette: { a: '#b38cfa', b: '#7c3aed', c: '#d1d5db', d: '#1f2937', e: '#ddd6fe', f: '#4c1d95' },
    rows: [
      '...eaaaae...',
      '..eaaaaae...',
      '..aaaaaaaa..',
      '..eaaaaaae..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbbbbbb..',
      '.bbbfbbfbbb.',
      '.bb.bbbb.bb.',
      '.bb.bbbb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  security: {
    palette: { a: '#ef4444', b: '#991b1b', c: '#d1d5db', d: '#1f2937', e: '#fca5a5', f: '#7f1d1d' },
    rows: [
      '....aaaa....',
      '..aaaaaaaa..',
      '..aaaaaaea..',
      '..aaaaaaaa..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..ffaaffff..',
      '.ffaaaaffff.',
      '.ff.ffff.ff.',
      '.ff.ffff.ff.',
      '....ffff....',
      '...dd..dd...',
    ],
  },
  'tech-writer': {
    palette: { a: '#14b8a6', b: '#0d9488', c: '#d1d5db', d: '#1f2937', e: '#99f6e4', f: '#134e4a' },
    rows: [
      '....aaaa....',
      '...aaaaaa...',
      '..aeaaaaae..',
      '..aaaaaaaa..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbbbbbb..',
      '.bbbbebbbb..',
      '.bb.bbbb.bb.',
      '.bb.bbbb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  'code-reviewer': {
    palette: { a: '#f5b731', b: '#d97706', c: '#d1d5db', d: '#1f2937', e: '#fde68a', f: '#92400e' },
    rows: [
      '....aaaa....',
      '...aaaaaa...',
      '..eeaaaeee..',
      '..eeaaaaee..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..bbbbbbbb..',
      '.bbbbbabbbb.',
      '.bb.bbbb.bb.',
      '.bb.bffb.bb.',
      '....bbbb....',
      '...dd..dd...',
    ],
  },
  'blockchain-auditor': {
    palette: { a: '#f59e0b', b: '#b45309', c: '#d1d5db', d: '#1f2937', e: '#fcd34d', f: '#78350f' },
    rows: [
      '..eeeeeeee..',
      '..eaaaaaae..',
      '..aaaaaaaa..',
      '..eaaaaaae..',
      '..dccccccd..',
      '..dccdcccd..',
      '...dcccd....',
      '....dccd....',
      '..ffbbbbff..',
      '.fffbbbbfff.',
      '.ff.ffff.ff.',
      '.ff.ffff.ff.',
      '....ffff....',
      '...dd..dd...',
    ],
  },
}

interface PixelAvatarProps {
  agentId: string
  size?: number // override scale
  className?: string
}

export default function PixelAvatar({ agentId, size, className }: PixelAvatarProps) {
  const sprite = SPRITES[agentId]
  if (!sprite) return null

  const scale = size ? Math.round(size / 14) : S
  const width = 12 * scale
  const height = 14 * scale

  const shadow = size
    ? spriteToShadow(sprite.rows, sprite.palette).replaceAll(`${S}px`, `${scale}px`)
    : spriteToShadow(sprite.rows, sprite.palette)

  return (
    <div
      className={className}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        imageRendering: 'pixelated',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -scale,
          left: -scale,
          width: scale,
          height: scale,
          boxShadow: shadow,
        }}
      />
    </div>
  )
}
