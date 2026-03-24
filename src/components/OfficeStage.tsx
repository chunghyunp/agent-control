'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import type { AgentDef, AgentState } from '@/types'
import PixelAvatar from './PixelAvatar'

// ── Station positions (% of stage width/height) ──────────────────
const STATIONS: Record<string, { x: number; y: number }> = {
  // Command — top center
  orchestrator:        { x: 37, y: 8  },
  architect:           { x: 57, y: 8  },
  // Design — left column
  'ux-researcher':     { x: 6,  y: 38 },
  'ui-designer':       { x: 6,  y: 56 },
  'brand-guardian':    { x: 6,  y: 74 },
  // Engineering — center area
  frontend:            { x: 32, y: 38 },
  backend:             { x: 50, y: 38 },
  web3:                { x: 32, y: 58 },
  security:            { x: 50, y: 58 },
  'tech-writer':       { x: 41, y: 76 },
  // Testing — right column
  'code-reviewer':     { x: 78, y: 42 },
  'blockchain-auditor':{ x: 78, y: 64 },
}

// ── Meeting cluster positions ────────────────────────────────────
const MEETING_POS: Record<string, { x: number; y: number }> = {
  orchestrator:        { x: 44, y: 35 },
  architect:           { x: 50, y: 35 },
  'ux-researcher':     { x: 38, y: 42 },
  'ui-designer':       { x: 42, y: 45 },
  'brand-guardian':    { x: 35, y: 45 },
  frontend:            { x: 48, y: 42 },
  backend:             { x: 52, y: 45 },
  web3:                { x: 45, y: 48 },
  security:            { x: 50, y: 48 },
  'tech-writer':       { x: 47, y: 51 },
  'code-reviewer':     { x: 55, y: 42 },
  'blockchain-auditor':{ x: 58, y: 45 },
}

// ── Idle props per character ─────────────────────────────────────
const IDLE_PROPS: Record<string, string[]> = {
  orchestrator:        ['📋', '☕', '👀'],
  architect:           ['📐', '📝', '🏗️'],
  'ux-researcher':     ['📝', '💡', '📌'],
  'ui-designer':       ['🎨', '✨', '🖌️'],
  'brand-guardian':    ['🛡️', '🎨', '🤔'],
  frontend:            ['💻', '🎧', '☕'],
  backend:             ['🔧', '💾', '🖥️'],
  web3:                ['🪙', '⛓️', '✨'],
  security:            ['🔒', '🔍', '⚠️'],
  'tech-writer':       ['📖', '✍️', '📄'],
  'code-reviewer':     ['🔎', '✅', '❌'],
  'blockchain-auditor':['⛓️', '🔴', '✓'],
}

// ── Social interaction pairs [agent1, agent2, emoji] ─────────────
const SOCIAL_PAIRS: [string, string, string][] = [
  ['orchestrator', 'frontend', '👀'],
  ['orchestrator', 'code-reviewer', '👀'],
  ['orchestrator', 'architect', '📋'],
  ['brand-guardian', 'ui-designer', '🤔'],
  ['brand-guardian', 'ui-designer', '👍'],
  ['frontend', 'backend', '✋'],
  ['security', 'web3', '🔍'],
  ['ux-researcher', 'ui-designer', '💬'],
  ['tech-writer', 'frontend', '💬'],
  ['code-reviewer', 'blockchain-auditor', '💬'],
  ['architect', 'backend', '📐'],
  ['security', 'frontend', '🔒'],
]

// ── Furniture definitions ────────────────────────────────────────
interface FurnitureItem {
  type: 'desk' | 'monitor' | 'whiteboard' | 'server' | 'easel' | 'bookshelf' | 'lamp'
  x: number
  y: number
  w?: number
  h?: number
}

const FURNITURE: FurnitureItem[] = [
  // Command desks
  { type: 'desk', x: 35, y: 14, w: 10, h: 4 },
  { type: 'monitor', x: 37, y: 13 },
  { type: 'desk', x: 55, y: 14, w: 10, h: 4 },
  { type: 'monitor', x: 57, y: 13 },
  { type: 'whiteboard', x: 47, y: 4, w: 6, h: 6 },
  // Design area
  { type: 'desk', x: 4, y: 44, w: 10, h: 3 },
  { type: 'easel', x: 16, y: 54 },
  { type: 'desk', x: 4, y: 62, w: 10, h: 3 },
  { type: 'whiteboard', x: 16, y: 36, w: 5, h: 5 },
  { type: 'lamp', x: 2, y: 36 },
  // Engineering area
  { type: 'desk', x: 30, y: 44, w: 10, h: 3 },
  { type: 'monitor', x: 32, y: 43 },
  { type: 'desk', x: 48, y: 44, w: 10, h: 3 },
  { type: 'monitor', x: 50, y: 43 },
  { type: 'server', x: 60, y: 55, w: 4, h: 10 },
  { type: 'desk', x: 30, y: 64, w: 10, h: 3 },
  { type: 'desk', x: 48, y: 64, w: 10, h: 3 },
  { type: 'desk', x: 39, y: 82, w: 10, h: 3 },
  { type: 'bookshelf', x: 39, y: 70, w: 6, h: 5 },
  { type: 'lamp', x: 28, y: 36 },
  { type: 'lamp', x: 60, y: 36 },
  // Testing area
  { type: 'desk', x: 76, y: 48, w: 12, h: 3 },
  { type: 'monitor', x: 78, y: 47 },
  { type: 'desk', x: 76, y: 70, w: 12, h: 3 },
  { type: 'lamp', x: 90, y: 40 },
]

// ── Types ────────────────────────────────────────────────────────
interface SocialEvent {
  agent1: string
  agent2: string
  emoji: string
}

type StageMode = 'ambient' | 'meeting' | 'briefing' | 'dispersing' | 'executing'

interface OfficeStageProps {
  agents: AgentDef[]
  agentStates: Record<string, AgentState>
  isRunning: boolean
}

// ── Furniture component ──────────────────────────────────────────
const Furniture = memo(function Furniture({ item }: { item: FurnitureItem }) {
  const base = {
    position: 'absolute' as const,
    left: `${item.x}%`,
    top: `${item.y}%`,
    imageRendering: 'pixelated' as const,
    pointerEvents: 'none' as const,
  }

  switch (item.type) {
    case 'desk':
      return (
        <div style={{
          ...base,
          width: `${item.w ?? 10}%`,
          height: `${item.h ?? 3}%`,
          background: 'linear-gradient(180deg, #2a1f14 0%, #1e160e 100%)',
          border: '1px solid #3d2a18',
          borderRadius: 2,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }} />
      )
    case 'monitor':
      return (
        <div style={{
          ...base,
          width: 16,
          height: 12,
          background: '#0d1520',
          border: '2px solid #2d3748',
          borderRadius: 1,
          boxShadow: '0 0 8px rgba(124,110,246,0.15)',
        }}>
          <div style={{
            position: 'absolute',
            inset: 2,
            background: 'rgba(124,110,246,0.06)',
            animation: 'monitorFlicker 4s ease-in-out infinite',
          }} />
        </div>
      )
    case 'whiteboard':
      return (
        <div style={{
          ...base,
          width: `${item.w ?? 6}%`,
          height: `${item.h ?? 5}%`,
          background: 'rgba(200,210,220,0.08)',
          border: '1px solid rgba(200,210,220,0.15)',
          borderRadius: 2,
        }} />
      )
    case 'server':
      return (
        <div style={{
          ...base,
          width: `${item.w ?? 4}%`,
          height: `${item.h ?? 8}%`,
          background: 'linear-gradient(180deg, #111827 0%, #0d1117 100%)',
          border: '1px solid #1f2937',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute',
              left: 3,
              top: `${20 + i * 22}%`,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: i % 2 === 0 ? '#10b981' : '#f59e0b',
              animation: `blink ${1.5 + i * 0.7}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }} />
          ))}
        </div>
      )
    case 'easel':
      return (
        <div style={{
          ...base,
          width: 14,
          height: 20,
        }}>
          {/* Canvas */}
          <div style={{
            width: 12,
            height: 14,
            background: 'rgba(244,114,182,0.06)',
            border: '1px solid rgba(244,114,182,0.15)',
            borderRadius: 1,
          }} />
          {/* Legs */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 2,
            width: 1,
            height: 6,
            background: '#3d2a18',
            transform: 'rotate(-8deg)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 3,
            width: 1,
            height: 6,
            background: '#3d2a18',
            transform: 'rotate(8deg)',
          }} />
        </div>
      )
    case 'bookshelf':
      return (
        <div style={{
          ...base,
          width: `${item.w ?? 5}%`,
          height: `${item.h ?? 5}%`,
          background: '#1e160e',
          border: '1px solid #2a1f14',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          padding: 2,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 1,
              background: '#3d2a18',
            }} />
          ))}
        </div>
      )
    case 'lamp':
      return (
        <div style={{
          ...base,
          width: 6,
          height: 6,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
            animation: 'lampGlow 3s ease-in-out infinite',
          }} />
        </div>
      )
    default:
      return null
  }
})

// ── Division area background ─────────────────────────────────────
function DivisionArea({ label, color, x, y, w, h }: {
  label: string; color: string; x: number; y: number; w: number; h: number
}) {
  return (
    <>
      <div style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        background: `${color}04`,
        border: `1px solid ${color}10`,
        borderRadius: 8,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        left: `${x + w / 2}%`,
        top: `${y + 0.5}%`,
        transform: 'translateX(-50%)',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 6,
        color: `${color}60`,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </>
  )
}

// ── Single character in the office ───────────────────────────────
function OfficeCharacter({ agent, agentState, stageMode, socialEvent, propIndex }: {
  agent: AgentDef
  agentState: AgentState
  stageMode: StageMode
  socialEvent: SocialEvent | null
  propIndex: number
}) {
  const station = STATIONS[agent.id]
  if (!station) return null

  // Determine position
  let tx = station.x
  let ty = station.y

  const isSocial = socialEvent &&
    (socialEvent.agent1 === agent.id || socialEvent.agent2 === agent.id)

  if (stageMode === 'meeting' || stageMode === 'briefing') {
    const mp = MEETING_POS[agent.id]
    if (mp) { tx = mp.x; ty = mp.y }
  } else if (isSocial && socialEvent) {
    const otherId = socialEvent.agent1 === agent.id ? socialEvent.agent2 : socialEvent.agent1
    const otherStation = STATIONS[otherId]
    if (otherStation) {
      tx = (station.x + otherStation.x) / 2
      ty = (station.y + otherStation.y) / 2
    }
  }

  // Determine animation class
  let animClass = `idle-${agent.id.replace(/[^a-z0-9]/g, '-')}`
  const isWorking = agentState.status === 'working' || agentState.status === 'reviewing'

  if (stageMode === 'meeting' || stageMode === 'briefing') {
    animClass = '' // still during meeting
  } else if (stageMode === 'executing' && isWorking) {
    animClass = 'char-working-intense'
  } else if (stageMode === 'dispersing') {
    animClass = '' // walking back
  }

  // Idle props
  const props = IDLE_PROPS[agent.id] ?? []
  const currentProp = props[propIndex % props.length]
  const showProp = !isWorking && stageMode === 'ambient'

  // Status indicator
  const showProgress = isWorking && stageMode === 'executing'

  return (
    <div
      style={{
        position: 'absolute',
        left: `${tx}%`,
        top: `${ty}%`,
        transition: 'left 1.8s cubic-bezier(0.4, 0, 0.2, 1), top 1.8s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: isWorking ? 15 : isSocial ? 12 : 5,
        willChange: 'left, top',
      }}
    >
      {/* Character wrapper with idle animation */}
      <div className={animClass} style={{ position: 'relative' }}>
        {/* Pixel avatar */}
        <PixelAvatar agentId={agent.id} />

        {/* Working glow */}
        {isWorking && (
          <div style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${agent.color}20 0%, transparent 70%)`,
            animation: 'pulseGlow 1.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Name label */}
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 4,
        color: isWorking ? agent.color : '#4b5563',
        textAlign: 'center',
        marginTop: 2,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        transition: 'color 0.5s ease',
      }}>
        {agent.name}
      </div>

      {/* Progress bar when working */}
      {showProgress && (
        <div style={{
          width: 32,
          height: 3,
          background: 'rgba(31,41,55,0.8)',
          borderRadius: 2,
          marginTop: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${agentState.progress}%`,
            background: agent.color,
            borderRadius: 2,
            transition: 'width 1s ease',
          }} />
        </div>
      )}

      {/* Idle prop floating nearby */}
      {showProp && currentProp && (
        <div
          className="prop-float"
          style={{
            position: 'absolute',
            top: -8,
            right: -10,
            fontSize: 8,
            pointerEvents: 'none',
            opacity: 0.7,
          }}
        >
          {currentProp}
        </div>
      )}

      {/* Social bubble */}
      {isSocial && socialEvent && (
        <div
          className="speech-bubble-in"
          style={{
            position: 'absolute',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(13,17,23,0.95)',
            border: `1px solid ${agent.color}40`,
            borderRadius: 6,
            padding: '2px 6px',
            fontSize: 10,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          {socialEvent.emoji}
        </div>
      )}

      {/* Working speech bubble */}
      {isWorking && agentState.currentTask && (
        <div
          className="speech-bubble-in"
          style={{
            position: 'absolute',
            top: -18,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(13,17,23,0.95)',
            border: `1px solid ${agent.color}30`,
            borderRadius: 4,
            padding: '2px 5px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 3.5,
            color: '#9ca3af',
            maxWidth: 80,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          {agentState.currentTask}
        </div>
      )}

      {/* Done/Error badge */}
      {agentState.status === 'done' && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -4,
          fontSize: 8,
          pointerEvents: 'none',
        }}>✅</div>
      )}
      {agentState.status === 'error' && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -4,
          fontSize: 8,
          pointerEvents: 'none',
          animation: 'pixelError 0.4s ease 3',
        }}>❌</div>
      )}
    </div>
  )
}

// ── Main OfficeStage component ───────────────────────────────────
export default function OfficeStage({ agents, agentStates, isRunning }: OfficeStageProps) {
  const [stageMode, setStageMode] = useState<StageMode>('ambient')
  const [socialEvent, setSocialEvent] = useState<SocialEvent | null>(null)
  const [propIndices, setPropIndices] = useState<Record<string, number>>({})
  const prevRunning = useRef(false)
  const socialTimer = useRef<NodeJS.Timeout>()
  const propTimer = useRef<NodeJS.Timeout>()

  // ── Meeting animation when task starts ──
  useEffect(() => {
    if (isRunning && !prevRunning.current) {
      // Task just started → meeting sequence
      setSocialEvent(null) // cancel social
      setStageMode('meeting')

      const t1 = setTimeout(() => setStageMode('briefing'), 2000)
      const t2 = setTimeout(() => setStageMode('dispersing'), 3500)
      const t3 = setTimeout(() => setStageMode('executing'), 5000)

      prevRunning.current = true
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
    if (!isRunning && prevRunning.current) {
      // Task ended → back to ambient
      setStageMode('ambient')
      prevRunning.current = false
    }
  }, [isRunning])

  // ── Social interactions (random, every 12-25 seconds) ──
  const scheduleSocial = useCallback(() => {
    const delay = 12000 + Math.random() * 13000
    socialTimer.current = setTimeout(() => {
      if (stageMode !== 'ambient') {
        scheduleSocial()
        return
      }
      // Pick a random pair where neither is working
      const available = SOCIAL_PAIRS.filter(([a, b]) =>
        agentStates[a]?.status !== 'working' &&
        agentStates[b]?.status !== 'working'
      )
      if (available.length > 0) {
        const [a1, a2, emoji] = available[Math.floor(Math.random() * available.length)]
        setSocialEvent({ agent1: a1, agent2: a2, emoji })
        // Clear after 3 seconds
        setTimeout(() => setSocialEvent(null), 3000)
      }
      scheduleSocial()
    }, delay)
  }, [stageMode, agentStates])

  useEffect(() => {
    scheduleSocial()
    return () => { if (socialTimer.current) clearTimeout(socialTimer.current) }
  }, [scheduleSocial])

  // ── Rotate idle props every 5-8 seconds ──
  useEffect(() => {
    const rotate = () => {
      const delay = 5000 + Math.random() * 3000
      propTimer.current = setTimeout(() => {
        // Pick 2-3 random agents to rotate props
        const ids = agents.map(a => a.id)
        const count = 2 + Math.floor(Math.random() * 2)
        const updates: Record<string, number> = {}
        for (let i = 0; i < count; i++) {
          const id = ids[Math.floor(Math.random() * ids.length)]
          updates[id] = (propIndices[id] ?? 0) + 1
        }
        setPropIndices(prev => ({ ...prev, ...updates }))
        rotate()
      }, delay)
    }
    rotate()
    return () => { if (propTimer.current) clearTimeout(propTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Meeting briefing bubble on orchestrator ──
  const showBriefing = stageMode === 'briefing'

  return (
    <div
      className="office-stage"
      style={{
        position: 'relative',
        width: '100%',
        height: 480,
        background: 'linear-gradient(180deg, #080a12 0%, #0a0d18 50%, #0c1020 100%)',
        border: '1px solid rgba(31,41,55,0.5)',
        borderRadius: 16,
        overflow: 'hidden',
        imageRendering: 'pixelated',
      }}
    >
      {/* Floor grid pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(31,41,55,0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(31,41,55,0.08) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
      }} />

      {/* Ambient particles */}
      <div className="ambient-particles" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: 2,
            height: 2,
            borderRadius: '50%',
            background: 'rgba(124,110,246,0.15)',
            left: `${15 + i * 18}%`,
            top: `${10 + i * 15}%`,
            animation: `floatParticle ${8 + i * 2}s ease-in-out infinite`,
            animationDelay: `${i * 1.5}s`,
          }} />
        ))}
      </div>

      {/* Division areas */}
      <DivisionArea label="Command" color="#7c6ef6" x={28} y={2} w={44} h={24} />
      <DivisionArea label="Design" color="#ec4899" x={1} y={30} w={24} h={58} />
      <DivisionArea label="Engineering" color="#2dd4a8" x={27} y={30} w={40} h={62} />
      <DivisionArea label="Testing" color="#f5b731" x={69} y={30} w={24} h={58} />

      {/* Furniture */}
      {FURNITURE.map((f, i) => <Furniture key={i} item={f} />)}

      {/* Characters */}
      {agents.map(agent => (
        <OfficeCharacter
          key={agent.id}
          agent={agent}
          agentState={agentStates[agent.id]}
          stageMode={stageMode}
          socialEvent={socialEvent}
          propIndex={propIndices[agent.id] ?? 0}
        />
      ))}

      {/* Briefing bubble on orchestrator during meeting */}
      {showBriefing && (
        <div
          className="speech-bubble-in"
          style={{
            position: 'absolute',
            left: `${MEETING_POS.orchestrator.x}%`,
            top: `${MEETING_POS.orchestrator.y - 8}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(13,17,23,0.95)',
            border: '1px solid rgba(124,110,246,0.4)',
            borderRadius: 6,
            padding: '4px 8px',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 5,
            color: '#a78bfa',
            whiteSpace: 'nowrap',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          📋 Assigning tasks...
        </div>
      )}

      {/* Stage mode indicator */}
      <div style={{
        position: 'absolute',
        bottom: 6,
        right: 10,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5,
        color: stageMode === 'ambient' ? '#374151' : '#7c6ef6',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
      }}>
        {stageMode === 'ambient' ? 'OFFICE · AMBIENT' :
         stageMode === 'meeting' ? '🚶 GATHERING...' :
         stageMode === 'briefing' ? '📋 BRIEFING...' :
         stageMode === 'dispersing' ? '🏃 DISPERSING...' :
         '⚡ EXECUTING'}
      </div>

      {/* Agent count badge */}
      <div style={{
        position: 'absolute',
        bottom: 6,
        left: 10,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5,
        color: '#374151',
        pointerEvents: 'none',
      }}>
        {agents.filter(a => agentStates[a.id]?.status === 'working').length > 0
          ? `${agents.filter(a => agentStates[a.id]?.status === 'working').length} ACTIVE`
          : '12 AGENTS ONLINE'}
      </div>
    </div>
  )
}
