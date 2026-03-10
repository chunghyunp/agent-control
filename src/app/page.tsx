'use client'

import { useReducer, useEffect, useCallback, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AGENT_MODELS, PRICING } from '@/lib/agents'
import type {
  AgentDef,
  AgentState,
  AppState,
  AppAction,
  LogEntry,
  PipelineStep,
  Task,
} from '@/types'

// ─── DYNAMIC IMPORTS (avoids SSR issues with socket.io) ─────────────
const AgentCard = dynamic(() => import('@/components/AgentCard'), { ssr: false })
const PipelineViz = dynamic(() => import('@/components/PipelineViz'), { ssr: false })
const LogViewer = dynamic(() => import('@/components/LogViewer'), { ssr: false })
const CostBreakdown = dynamic(() => import('@/components/CostBreakdown'), { ssr: false })
const TaskHistory = dynamic(() => import('@/components/TaskHistory'), { ssr: false })
const CommandInput = dynamic(() => import('@/components/CommandInput'), { ssr: false })
const SummaryView = dynamic(() => import('@/components/SummaryView'), { ssr: false })

// ─── FILE PATH PARSER ───────────────────────────────────────────────
function parseFilePaths(text: string): string[] {
  const paths = new Set<string>()
  // **src/foo.tsx** bold filenames with a slash
  for (const m of text.matchAll(/\*\*([^\s*`]+\.[a-zA-Z]{1,6})\*\*/g))
    if (m[1].includes('/')) paths.add(m[1])
  // `src/foo.tsx` backtick filenames with a slash
  for (const m of text.matchAll(/`([^\s`]+\.[a-zA-Z]{1,6})`/g))
    if (m[1].includes('/')) paths.add(m[1])
  return [...paths]
}

// ─── AGENT DEFINITIONS ──────────────────────────────────────────────
const AGENTS: AgentDef[] = [
  {
    id: 'supervisor',
    name: 'Supervisor',
    icon: '🧠',
    model: AGENT_MODELS.supervisor,
    role: 'Orchestrator · Specs · Delegation',
    color: '#7c6ef6',
    costIn: PRICING[AGENT_MODELS.supervisor].input,
    costOut: PRICING[AGENT_MODELS.supervisor].output,
  },
  {
    id: 'frontend',
    name: 'Frontend',
    icon: '🎨',
    model: AGENT_MODELS.frontend,
    role: 'React · TypeScript · Tailwind',
    color: '#e8608c',
    costIn: PRICING[AGENT_MODELS.frontend].input,
    costOut: PRICING[AGENT_MODELS.frontend].output,
  },
  {
    id: 'backend',
    name: 'Backend',
    icon: '⚙️',
    model: AGENT_MODELS.backend,
    role: 'API · DB · DevOps',
    color: '#2dd4a8',
    costIn: PRICING[AGENT_MODELS.backend].input,
    costOut: PRICING[AGENT_MODELS.backend].output,
  },
  {
    id: 'web3',
    name: 'Web3 Dev',
    icon: '🔗',
    model: AGENT_MODELS.web3,
    role: 'Solidity · Foundry · Security',
    color: '#b38cfa',
    costIn: PRICING[AGENT_MODELS.web3].input,
    costOut: PRICING[AGENT_MODELS.web3].output,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    icon: '🔍',
    model: AGENT_MODELS.reviewer,
    role: 'Code Review · QA · Testing',
    color: '#f5b731',
    costIn: PRICING[AGENT_MODELS.reviewer].input,
    costOut: PRICING[AGENT_MODELS.reviewer].output,
  },
]

// ─── INITIAL STATE ───────────────────────────────────────────────────
const initialAgents: Record<string, AgentState> = Object.fromEntries(
  AGENTS.map(a => [
    a.id,
    { status: 'idle', progress: 0, currentTask: null, tokensIn: 0, tokensOut: 0, startedAt: null, output: '', files: [] },
  ])
) as Record<string, AgentState>

const initialState: AppState = {
  tasks: [],
  activeTaskId: null,
  agents: initialAgents,
  pipeline: null,
  logs: [
    {
      id: 0,
      ts: Date.now(),
      agent: 'system',
      type: 'info',
      message: 'Agent Control initialized. 5 agents standing by.',
    },
  ],
  costs: {},
  isRunning: false,
  taskInput: '',
  tab: 'summary',
}

// ─── REDUCER ────────────────────────────────────────────────────────
function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_AGENT_STATUS':
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.id]: { ...state.agents[action.id], status: action.status },
        },
      }

    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.id]: { ...state.agents[action.id], ...action.data },
        },
      }

    case 'ADD_LOG': {
      const log: LogEntry = { ts: Date.now(), id: Date.now() + Math.random(), ...action.log }
      return { ...state, logs: [...state.logs, log] }
    }

    case 'ADD_TASK':
      return {
        ...state,
        tasks: [action.task, ...state.tasks],
        activeTaskId: action.task.id,
      }

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => (t.id === action.id ? { ...t, ...action.data } : t)),
      }

    case 'SET_PIPELINE':
      return { ...state, pipeline: action.pipeline }

    case 'UPDATE_PIPELINE_STEP':
      return {
        ...state,
        pipeline: state.pipeline?.map(s =>
          s.id === action.stepId ? { ...s, ...action.data } : s
        ) ?? null,
      }

    case 'SET_RUNNING':
      return { ...state, isRunning: action.value }

    case 'UPDATE_COST':
      return {
        ...state,
        costs: {
          ...state.costs,
          [action.agent]: {
            agent: action.agent,
            inputTokens: action.inputTokens,
            outputTokens: action.outputTokens,
            costUsd: action.costUsd,
          },
        },
      }

    case 'SET_AGENT_OUTPUT':
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.id]: { ...state.agents[action.id], output: action.output, files: action.files },
        },
      }

    case 'RESET_AGENTS':
      return {
        ...state,
        agents: Object.fromEntries(
          AGENTS.map(a => [
            a.id,
            { ...state.agents[a.id], status: 'idle', progress: 0, currentTask: null, startedAt: null, output: '', files: [] },
          ])
        ) as Record<string, AgentState>,
      }

    case 'SET_TAB':
      return { ...state, tab: action.tab }

    case 'SET_TASK_INPUT':
      return { ...state, taskInput: action.value }

    case 'LOAD_TASKS':
      return { ...state, tasks: action.tasks }

    default:
      return state
  }
}

// ─── SERVER-SIDE AGENT CALLER ────────────────────────────────────────
async function callAnthropicViaServer(
  model: string,
  agentId: string,
  userMessage: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message: userMessage, model }),
  })

  const data = await response.json() as {
    error?: string
    content?: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  if (!response.ok) {
    throw new Error(data.error ?? `HTTP ${response.status}`)
  }

  const text = data.content
    ?.filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('') ?? ''

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

// ─── ORCHESTRATION ENGINE ────────────────────────────────────────────
async function runPipeline(
  taskDescription: string,
  dispatch: React.Dispatch<AppAction>
) {
  dispatch({ type: 'SET_RUNNING', value: true })
  dispatch({ type: 'RESET_AGENTS' })

  const taskId = String(Date.now())
  const now = new Date().toLocaleTimeString('en', { hour12: false })

  await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: taskId, title: taskDescription }),
  }).catch(() => null)

  dispatch({
    type: 'ADD_TASK',
    task: { id: taskId, title: taskDescription, status: 'active', created: now },
  })

  const addLog = async (agent: string, type: LogEntry['type'], message: string) => {
    dispatch({ type: 'ADD_LOG', log: { agent, type, message } })
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, agent, type, message }),
    }).catch(() => null)
  }

  const recordCost = async (
    agent: string,
    inputTokens: number,
    outputTokens: number,
    model: string
  ) => {
    const pricing = PRICING[model] ?? { input: 3, output: 15 }
    const costUsd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
    dispatch({ type: 'UPDATE_COST', agent, inputTokens, outputTokens, costUsd })
    dispatch({ type: 'UPDATE_AGENT', id: agent, data: { tokensIn: inputTokens, tokensOut: outputTokens } })
    await fetch('/api/costs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, agent, inputTokens, outputTokens, costUsd }),
    }).catch(() => null)
    return costUsd
  }

  const callAgent = async (
    agentId: string,
    userMessage: string
  ): Promise<{ text: string; error?: string }> => {
    const agentDef = AGENTS.find(a => a.id === agentId)!
    dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'working', startedAt: Date.now(), progress: 0 } })
    await addLog(agentId, 'info', 'Starting work...')

    let progress = 0
    const progressInterval = setInterval(() => {
      progress = Math.min(92, progress + Math.floor(Math.random() * 10) + 3)
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { progress } })
    }, 1800)

    try {
      const { text, inputTokens, outputTokens } = await callAnthropicViaServer(
        agentDef.model,
        agentId,
        userMessage
      )

      clearInterval(progressInterval)
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'done', progress: 100 } })
      dispatch({ type: 'SET_AGENT_OUTPUT', id: agentId, output: text, files: parseFilePaths(text) })
      const cost = await recordCost(agentId, inputTokens, outputTokens, agentDef.model)
      await addLog(agentId, 'success', `Complete — ${inputTokens + outputTokens} tokens ($${cost.toFixed(4)})`)

      await fetch('/api/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'agent:done', data: { taskId, agentId, inputTokens, outputTokens } }),
      }).catch(() => null)

      return { text }
    } catch (err) {
      clearInterval(progressInterval)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'error', progress: 0 } })
      await addLog(agentId, 'error', `Error: ${errMsg}`)
      return { text: '', error: errMsg }
    }
  }

  // ── STEP 1: Supervisor planning ──────────────────────────────────
  dispatch({
    type: 'SET_PIPELINE',
    pipeline: [
      { id: 'plan', label: 'Planning', agent: 'supervisor', status: 'working' },
      { id: 'implement', label: 'Implement', agent: 'frontend', status: 'idle' },
      { id: 'review', label: 'Review', agent: 'reviewer', status: 'idle' },
      { id: 'deliver', label: 'Deliver', agent: 'supervisor', status: 'idle' },
    ],
  })

  await addLog('supervisor', 'delegate', `New task: "${taskDescription}"`)
  const planResult = await callAgent(
    'supervisor',
    `Analyze this task and output a plan with task_type and agent delegation:\n\n${taskDescription}`
  )

  if (planResult.error) {
    dispatch({ type: 'UPDATE_TASK', id: taskId, data: { status: 'error' } })
    dispatch({ type: 'SET_RUNNING', value: false })
    return
  }

  dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'plan', data: { status: 'done' } })

  // ── STEP 2: Determine which agents to activate ───────────────────
  const lower = taskDescription.toLowerCase()
  const needsWeb3 = /contract|token|staking|erc|solidity|web3|blockchain|nft|defi/.test(lower)
  const needsFrontend = /page|ui|component|frontend|dashboard|form|button|display|react|tsx/.test(lower)
  const needsBackend = /api|server|database|endpoint|auth|backend|deploy|docker|prisma|express/.test(lower)

  const agentsToRun: string[] = []
  if (needsWeb3) agentsToRun.push('web3')
  if (needsBackend || !needsFrontend) agentsToRun.push('backend')
  if (needsFrontend || !needsBackend) agentsToRun.push('frontend')
  if (agentsToRun.length === 0) agentsToRun.push('backend', 'frontend')

  const dynamicPipeline: PipelineStep[] = [
    { id: 'plan', label: 'Plan', agent: 'supervisor', status: 'done' },
    ...agentsToRun.map(id => ({
      id,
      label: AGENTS.find(a => a.id === id)!.name,
      agent: id,
      status: 'working' as const,
    })),
    { id: 'review', label: 'Review', agent: 'reviewer', status: 'waiting' },
    { id: 'deliver', label: 'Deliver', agent: 'supervisor', status: 'idle' },
  ]
  dispatch({ type: 'SET_PIPELINE', pipeline: dynamicPipeline })

  await fetch('/api/emit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'pipeline:update', data: { taskId, pipeline: dynamicPipeline } }),
  }).catch(() => null)

  await fetch('/api/tasks/' + taskId, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pipeline: JSON.stringify(dynamicPipeline) }),
  }).catch(() => null)

  agentsToRun.forEach(id => {
    dispatch({ type: 'UPDATE_AGENT', id, data: { status: 'waiting', currentTask: taskDescription } })
  })
  dispatch({ type: 'UPDATE_AGENT', id: 'reviewer', data: { status: 'waiting' } })

  // ── STEP 3: Run implementation agents in parallel ────────────────
  const supervisorPlan = planResult.text
  const implPromises = agentsToRun.map(async agentId => {
    await addLog('supervisor', 'delegate', `→ ${agentId}: Implement ${agentId} portion`)
    const prompt = `The Supervisor has planned this task:\n---\n${supervisorPlan}\n---\n\nYour specific job: Implement the ${agentId} portion of:\n"${taskDescription}"\n\nOutput production-ready code with explicit file paths.`
    const result = await callAgent(agentId, prompt)
    dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: agentId, data: { status: result.error ? 'error' : 'done' } })
    return { agentId, result }
  })

  const implResults = await Promise.all(implPromises)

  // ── STEP 4: Reviewer ─────────────────────────────────────────────
  dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'review', data: { status: 'working' } })
  dispatch({ type: 'UPDATE_AGENT', id: 'reviewer', data: { status: 'reviewing' } })

  const reviewInput = implResults
    .map(({ agentId, result }) =>
      `=== ${agentId.toUpperCase()} OUTPUT ===\n${result.text || result.error || 'No output'}\n`
    )
    .join('\n')

  await addLog('supervisor', 'delegate', `→ reviewer: Review all ${implResults.length} outputs`)
  const reviewResult = await callAgent(
    'reviewer',
    `Review these agent outputs for the task: "${taskDescription}"\n\n${reviewInput}`
  )

  dispatch({
    type: 'UPDATE_PIPELINE_STEP',
    stepId: 'review',
    data: { status: reviewResult.error ? 'error' : 'done' },
  })

  // ── STEP 5: Retry loop for CRITICAL/HIGH issues ──────────────────
  if (reviewResult.text && !reviewResult.error) {
    const hasCritical = /🔴\s*CRITICAL/i.test(reviewResult.text)
    const hasHigh = /🟠\s*HIGH/i.test(reviewResult.text)

    if (hasCritical || hasHigh) {
      await addLog('reviewer', 'warn', 'CRITICAL/HIGH issues found — triggering retry for flagged agents')

      const flaggedAgents = agentsToRun.filter(id => {
        const agentDef = AGENTS.find(a => a.id === id)!
        return reviewResult.text.toLowerCase().includes(id.toLowerCase()) ||
               reviewResult.text.toLowerCase().includes(agentDef.name.toLowerCase())
      })

      const retryTargets = flaggedAgents.length > 0 ? flaggedAgents : agentsToRun

      const retryPromises = retryTargets.map(async agentId => {
        await addLog('supervisor', 'delegate', `→ ${agentId}: Retry with reviewer feedback`)
        const prompt = `You previously wrote code for this task:\n"${taskDescription}"\n\nThe reviewer found these issues:\n${reviewResult.text}\n\nPlease revise your implementation to fix ALL CRITICAL and HIGH severity issues. Output the complete corrected code with file paths.`
        return callAgent(agentId, prompt)
      })

      await Promise.all(retryPromises)
      await addLog('reviewer', 'info', 'Retry complete — finalizing')
    }
  }

  // ── STEP 6: Deliver ──────────────────────────────────────────────
  dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'deliver', data: { status: 'done' } })
  dispatch({ type: 'UPDATE_AGENT', id: 'supervisor', data: { status: 'done' } })

  const finalResult = reviewResult.text || implResults.map(r => r.result.text).join('\n\n')
  dispatch({ type: 'UPDATE_TASK', id: taskId, data: { status: 'completed', result: finalResult } })
  await addLog('supervisor', 'success', `Task complete: "${taskDescription}"`)

  await fetch('/api/tasks/' + taskId, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'completed', result: finalResult }),
  }).catch(() => null)

  await fetch('/api/emit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'task:complete', data: { taskId, title: taskDescription } }),
  }).catch(() => null)

  dispatch({ type: 'SET_TAB', tab: 'summary' })
  dispatch({ type: 'SET_RUNNING', value: false })
}

// ─── MISSING KEY BANNER ───────────────────────────────────────────────
function MissingKeyBanner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c16',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(13,17,23,0.9)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 16,
        padding: '40px 48px',
        maxWidth: 480,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#ef4444',
          marginBottom: 12,
          fontFamily: "'Inter', sans-serif",
        }}>
          ANTHROPIC_API_KEY not found
        </h2>
        <p style={{
          fontSize: 13,
          color: '#9ca3af',
          marginBottom: 24,
          lineHeight: 1.6,
          fontFamily: "'Inter', sans-serif",
        }}>
          Add your API key to the <code style={{ color: '#e5e7eb', background: 'rgba(55,65,81,0.4)', padding: '1px 6px', borderRadius: 4 }}>.env</code> file and restart the server:
        </p>
        <div style={{
          background: '#0a0c16',
          border: '1px solid rgba(55,65,81,0.6)',
          borderRadius: 8,
          padding: '14px 18px',
          fontFamily: '"DM Mono", monospace',
          fontSize: 12,
          color: '#a78bfa',
          textAlign: 'left',
        }}>
          ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
        </div>
      </div>
    </div>
  )
}

// ─── MAIN APP COMPONENT ───────────────────────────────────────────────
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [now, setNow] = useState(() => new Date())
  const [keyMissing, setKeyMissing] = useState(false)
  const socketRef = useRef<import('socket.io-client').Socket | null>(null)

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Check API key on mount
  useEffect(() => {
    fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: '', message: 'ping', model: 'claude-haiku-4-5' }),
    })
      .then(r => {
        if (r.status === 500) {
          return r.json().then((d: { error?: string }) => {
            if (d.error?.includes('ANTHROPIC_API_KEY')) setKeyMissing(true)
          })
        }
      })
      .catch(() => null)
  }, [])

  // Load persisted tasks on mount
  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const tasks = (data as Array<{
            id: string
            title: string
            status: string
            result?: string | null
            createdAt: string
          }>).map(t => ({
            id: t.id,
            title: t.title,
            status: (t.status === 'completed' ? 'completed' : t.status === 'error' ? 'error' : 'pending') as Task['status'],
            result: t.result ?? undefined,
            created: new Date(t.createdAt).toLocaleTimeString('en', { hour12: false }),
          }))
          dispatch({ type: 'LOAD_TASKS', tasks })
        }
      })
      .catch(() => null)
  }, [])

  // Socket.io — connect on mount
  useEffect(() => {
    let socket: import('socket.io-client').Socket | null = null

    const connect = async () => {
      const { io } = await import('socket.io-client')
      socket = io(window.location.origin, {
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
      })
      socketRef.current = socket

      socket.on('connect', () => {
        dispatch({ type: 'ADD_LOG', log: { agent: 'system', type: 'info', message: 'Socket.io connected' } })
      })

      socket.on('disconnect', () => {
        dispatch({ type: 'ADD_LOG', log: { agent: 'system', type: 'warn', message: 'Socket.io disconnected' } })
      })

      socket.on('log', (data: { agent: string; type: LogEntry['type']; message: string; ts?: number }) => {
        dispatch({ type: 'ADD_LOG', log: { ...data, ts: data.ts ?? Date.now() } })
      })

      socket.on('task:complete', (data: { taskId: string; title: string }) => {
        dispatch({ type: 'UPDATE_TASK', id: data.taskId, data: { status: 'completed' } })
      })

      socket.on('pipeline:update', (data: { taskId: string; pipeline: PipelineStep[] }) => {
        dispatch({ type: 'SET_PIPELINE', pipeline: data.pipeline })
      })
    }

    connect().catch(() => null)

    return () => {
      socket?.disconnect()
    }
  }, [])

  const handleSubmit = useCallback(
    async (taskDesc: string) => {
      if (state.isRunning) return
      await runPipeline(taskDesc, dispatch)
    },
    [state.isRunning]
  )

  // ── Missing key screen ───────────────────────────────────────────
  if (keyMissing) {
    return <MissingKeyBanner />
  }

  // ── Derived stats ────────────────────────────────────────────────
  const activeCount = Object.values(state.agents).filter(a => a.status === 'working').length
  const doneCount = Object.values(state.agents).filter(a => a.status === 'done').length
  const totalCost = Object.values(state.costs).reduce((s, c) => s + c.costUsd, 0)
  const tabs: Array<{ id: AppState['tab']; label: string; count?: number }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'logs', label: 'Live Logs', count: state.logs.length },
    { id: 'costs', label: 'Costs' },
    { id: 'tasks', label: 'Tasks', count: state.tasks.length },
  ]

  // ── Main dashboard ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0c16',
      color: '#e5e7eb',
      fontFamily: "'Inter', -apple-system, sans-serif",
      position: 'relative',
    }}>
      {/* Ambient glow blobs */}
      <div style={{
        position: 'fixed', top: -300, right: -200, width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(124,110,246,0.04) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: -300, left: -150, width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(179,140,250,0.03) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 0',
          borderBottom: '1px solid rgba(31,41,55,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c6ef6, #b38cfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'white', fontWeight: 700, flexShrink: 0,
            }}>◈</div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em', color: '#e5e7eb' }}>
                Agent Control
              </h1>
              <div style={{ fontSize: 9.5, color: '#374151', letterSpacing: '0.04em', marginTop: 1 }}>
                MULTI-AGENT DEVELOPMENT SYSTEM
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {state.isRunning && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                background: 'rgba(124,110,246,0.09)',
                borderRadius: 8,
                border: '1px solid rgba(124,110,246,0.15)',
              }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#7c6ef6',
                  animation: 'blink 1s infinite',
                }} />
                <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 500 }}>Processing</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 10, color: '#4b5563' }}>Connected</span>
            </div>
            <Link
              href="/settings"
              title="Settings"
              style={{
                display: 'flex', alignItems: 'center',
                color: '#4b5563', fontSize: 16, textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a89cf7')}
              onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
            >⚙️</Link>
            <span style={{
              fontSize: 10.5, color: '#374151',
              fontFamily: '"DM Mono", monospace',
            }}>
              {now.toLocaleTimeString('en', { hour12: false })}
            </span>
          </div>
        </header>

        {/* ── Stats bar ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 0' }}>
          {[
            { label: 'Active', value: `${activeCount}/5`, color: '#7c6ef6' },
            { label: 'Done', value: `${doneCount}/5`, color: '#10b981' },
            { label: 'Tasks', value: String(state.tasks.length), color: '#e8608c' },
            { label: 'Cost', value: `$${totalCost.toFixed(4)}`, color: '#f5b731' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(13,17,23,0.7)',
              border: '1px solid rgba(31,41,55,0.6)',
            }}>
              <div style={{
                fontSize: 9, color: '#4b5563', textTransform: 'uppercase',
                letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4,
              }}>
                {s.label}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: s.color,
                fontFamily: '"DM Mono", monospace', letterSpacing: '-0.01em',
              }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Agent Cards ─────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          padding: '2px 0 14px',
        }}>
          {AGENTS.map(a => (
            <AgentCard key={a.id} agent={a} state={state.agents[a.id]} />
          ))}
        </div>

        {/* ── Pipeline ────────────────────────────────────────────── */}
        {state.pipeline && (
          <PipelineViz
            steps={state.pipeline}
            agents={AGENTS}
            taskTitle={state.tasks[0]?.title}
          />
        )}

        {/* ── Main panel ──────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(13,17,23,0.7)',
          border: '1px solid rgba(31,41,55,0.6)',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: 380,
          marginBottom: 20,
        }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(31,41,55,0.6)' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
                style={{
                  padding: '11px 18px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: state.tab === t.id ? '#e5e7eb' : '#4b5563',
                  background: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${state.tab === t.id ? '#7c6ef6' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                {t.label}
                {t.count !== undefined && (
                  <span style={{
                    fontSize: 9,
                    background: state.tab === t.id ? 'rgba(124,110,246,0.18)' : 'rgba(55,65,81,0.4)',
                    color: state.tab === t.id ? '#a78bfa' : '#4b5563',
                    padding: '1px 6px',
                    borderRadius: 8,
                    fontWeight: 700,
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{
            flex: 1,
            overflow: 'hidden',
            padding: state.tab === 'logs' || state.tab === 'summary' ? 0 : '14px 16px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {state.tab === 'summary' && (
              <SummaryView agents={AGENTS} agentStates={state.agents} costs={state.costs} isRunning={state.isRunning} />
            )}
            {state.tab === 'logs' && (
              <LogViewer logs={state.logs} agents={AGENTS} />
            )}
            {state.tab === 'costs' && (
              <CostBreakdown agentDefs={AGENTS} agentStates={state.agents} />
            )}
            {state.tab === 'tasks' && (
              <TaskHistory tasks={state.tasks} />
            )}
          </div>

          {/* Command input */}
          <CommandInput onSubmit={handleSubmit} isRunning={state.isRunning} />
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 0 24px',
          borderTop: '1px solid rgba(31,41,55,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9.5,
          color: '#1f2937',
        }}>
          <span>5 agents · Supervisor pattern · Anthropic API · Socket.io · Prisma SQLite</span>
          <span>claude-sonnet-4-6 + claude-opus-4-6</span>
        </div>
      </div>
    </div>
  )
}
