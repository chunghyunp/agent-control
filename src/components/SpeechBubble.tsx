'use client'

interface SpeechBubbleProps {
  text: string
  color?: string
  visible?: boolean
}

export default function SpeechBubble({ text, color = '#7c6ef6', visible = true }: SpeechBubbleProps) {
  if (!visible || !text) return null

  return (
    <div
      className="speech-bubble-in"
      style={{
        position: 'relative',
        background: 'rgba(13,17,23,0.95)',
        border: `1px solid ${color}30`,
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 7,
        fontFamily: '"Press Start 2P", monospace',
        color: '#d1d5db',
        lineHeight: 1.6,
        maxWidth: 160,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        marginTop: 4,
      }}
    >
      {/* Tail */}
      <div style={{
        position: 'absolute',
        top: -4,
        left: 12,
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderBottom: `4px solid ${color}30`,
      }} />
      {text}
    </div>
  )
}
