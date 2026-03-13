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
const FilesView = dynamic(() => import('@/components/FilesView'), { ssr: false })

// ─── FILE PARSERS ────────────────────────────────────────────────────
/** Extract path → content from --- FILE: --- blocks (new format) */
function parseFileContents(text: string): Record<string, string> {
  const files: Record<string, string> = {}
  const pattern =
    /^---\s*FILE:\s*(\S+)\s*---[ \t]*\r?\n```[^\n]*\r?\n([\s\S]*?)```[ \t]*\r?\n---\s*END FILE\s*---/gm
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    files[m[1].trim()] = m[2]
  }
  return files
}

/** Extract file paths only (for display when content not available) */
function parseFilePaths(text: string): string[] {
  // Try new format first
  const newFmt: string[] = []
  const pat = /^---\s*FILE:\s*(\S+)\s*---/gm
  let m: RegExpExecArray | null
  while ((m = pat.exec(text)) !== null) newFmt.push(m[1].trim())
  if (newFmt.length > 0) return newFmt
  // Fallback: **bold** or `backtick` filenames
  const paths: string[] = []
  const boldPat = /\*\*([^\s*`]+\.[a-zA-Z]{1,6})\*\*/g
  while ((m = boldPat.exec(text)) !== null) if (m[1].includes('/') && !paths.includes(m[1])) paths.push(m[1])
  const btPat = /`([^\s`]+\.[a-zA-Z]{1,6})`/g
  while ((m = btPat.exec(text)) !== null) if (m[1].includes('/') && !paths.includes(m[1])) paths.push(m[1])
  return paths
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
    id: 'designer',
    name: 'Designer',
    icon: '✏️',
    model: AGENT_MODELS.designer,
    role: 'UI/UX · Design Specs · Layout',
    color: '#f472b6',
    costIn: PRICING[AGENT_MODELS.designer].input,
    costOut: PRICING[AGENT_MODELS.designer].output,
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
      message: 'Agent Control initialized. 6 agents standing by.',
    },
  ],
  costs: {},
  isRunning: false,
  taskInput: '',
  tab: 'summary',
  parsedFiles: {},
  totalExpectedFiles: 0,
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

    case 'ADD_LOG_DEDUP': {
      const log: LogEntry = { ts: Date.now(), id: Date.now() + Math.random(), ...action.log }
      // Skip if same agent + message was already added within the last 2 seconds
      const recent = state.logs.slice(-30)
      const isDup = recent.some(
        l =>
          l.agent === log.agent &&
          l.message === log.message &&
          Math.abs((l.ts ?? 0) - (log.ts ?? Date.now())) < 2000,
      )
      if (isDup) return state
      return { ...state, logs: [...state.logs, log] }
    }

    case 'MERGE_PARSED_FILES':
      return { ...state, parsedFiles: { ...state.parsedFiles, ...action.files } }

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

    case 'SET_TOTAL_EXPECTED':
      return { ...state, totalExpectedFiles: action.count }

    case 'RESET_AGENTS':
      return {
        ...state,
        parsedFiles: {},
        totalExpectedFiles: 0,
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
): Promise<{ text: string; inputTokens: number; outputTokens: number; stopReason: string }> {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message: userMessage, model }),
  })

  const data = await response.json() as {
    error?: string
    content?: Array<{ type: string; text?: string }>
    usage?: { input_tokens?: number; output_tokens?: number }
    stop_reason?: string
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
    stopReason: data.stop_reason ?? 'end_turn',
  }
}

// ─── FILE PLAN HELPERS ────────────────────────────────────────────────
interface FilePlan {
  batch: number
  agent: 'backend' | 'frontend' | 'web3'
  path: string
}

interface ReviewResult {
  approved: boolean
  missingFiles: string[]
}

const MAX_FILES_PER_CALL = 4

function parseSupervisorFilePlan(output: string): FilePlan[] {
  const match = output.match(/FILE_PLAN_START\r?\n([\s\S]*?)FILE_PLAN_END/)
  if (!match) return []
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const firstColon = line.indexOf(':')
      const secondColon = line.indexOf(':', firstColon + 1)
      if (firstColon === -1 || secondColon === -1) return null
      const batch = parseInt(line.slice(0, firstColon), 10)
      const agent = line.slice(firstColon + 1, secondColon).trim() as FilePlan['agent']
      const path = line.slice(secondColon + 1).trim()
      if (isNaN(batch) || !path || !['backend', 'frontend', 'web3'].includes(agent)) return null
      return { batch, agent, path }
    })
    .filter((x): x is FilePlan => x !== null)
}

function parseReviewResult(output: string): ReviewResult {
  const resultMatch = output.match(/REVIEW_RESULT_START\r?\n([\s\S]*?)REVIEW_RESULT_END/)
  const missingMatch = output.match(/MISSING_FILES_START\r?\n([\s\S]*?)MISSING_FILES_END/)

  let approved: boolean
  if (resultMatch) {
    approved = /Status:\s*APPROVED/i.test(resultMatch[1])
  } else {
    const hasRejected = /\bREJECTED\b/i.test(output)
    const hasApproved = /Status:\s*APPROVED/i.test(output)
    approved = hasApproved && !hasRejected
  }

  const missingFiles = missingMatch
    ? missingMatch[1].trim().split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'))
    : []

  return { approved, missingFiles }
}

function buildSupervisorPrompt(taskDescription: string): string {
  return `You are the Supervisor. Analyze this task and output a Canonical Spec + FILE_PLAN.

TASK: ${taskDescription}

After your spec, you MUST output a complete FILE_PLAN listing EVERY file the complete app needs.

FILE_PLAN FORMAT (use EXACTLY this):
FILE_PLAN_START
1:backend:package.json
1:backend:tsconfig.json
2:backend:lib/db.ts
3:backend:app/api/health/route.ts
4:frontend:types/index.ts
5:frontend:components/Button.tsx
6:frontend:app/page.tsx
FILE_PLAN_END

BATCH ORDER (assign each file to the right batch):
Batch 1 = Backend config: package.json, tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js, .env.example, .gitignore, railway.json, prisma/schema.prisma
Batch 2 = Backend lib: all lib/*.ts files (db.ts, auth.ts, storage.ts, etc.)
Batch 3 = Backend API: all app/api/**/route.ts files
Batch 4 = Frontend types + hooks: types/*.ts, hooks/*.ts
Batch 5 = Frontend components: components/**/*.tsx
Batch 6 = Frontend pages: app/layout.tsx, app/page.tsx, app/*/page.tsx
Batch 7 = Web3: contracts/*.sol, web3 hooks (only if this task needs blockchain)

RULES:
- Include EVERY file the complete app needs — do NOT omit config files
- Assign backend, frontend, or web3 (lowercase)
- File paths must be exact (no leading slashes)
- The FILE_PLAN must be complete — the agents will ONLY generate files listed here
- Typical Next.js app has 25-50 files total

Output your Canonical Spec first, then the FILE_PLAN_START...FILE_PLAN_END block at the very end.`
}

function buildBatchPrompt(
  agentId: string,
  taskDescription: string,
  filePaths: string[],
  supervisorPlan: string,
  generatedFilePaths: string[],
  designSpec?: string,
): string {
  const agentRole = agentId === 'frontend' ? 'Frontend (React/TypeScript/Tailwind)'
    : agentId === 'backend' ? 'Backend (Next.js API Routes/Prisma/Node.js)'
    : 'Web3 (Solidity/Foundry)'

  const designSection = agentId === 'frontend' && designSpec
    ? `\n\nDESIGNER SPEC — You MUST follow this design spec exactly. Match every layout, color, spacing, animation, and mobile breakpoint described below:\n${designSpec.slice(0, 6000)}\n`
    : ''

  return `You are the ${agentRole} specialist.

TASK: ${taskDescription}

SUPERVISOR PLAN:
${supervisorPlan.slice(0, 3000)}${designSection}

YOUR ASSIGNMENT — Generate these ${filePaths.length} file${filePaths.length !== 1 ? 's' : ''} with complete, production-ready code:
${filePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Already generated files (for context, do NOT regenerate these):
${generatedFilePaths.length > 0 ? generatedFilePaths.join('\n') : 'None yet'}

CRITICAL OUTPUT FORMAT — Every file MUST use this EXACT format:

--- FILE: path/to/file.ext ---
\`\`\`typescript
// complete code here
\`\`\`
--- END FILE ---

RULES:
- Output ALL ${filePaths.length} file${filePaths.length !== 1 ? 's' : ''} listed above
- No placeholder code, no TODOs, no "implement later" — complete working code only
- Each file MUST be wrapped in --- FILE: path --- and --- END FILE --- delimiters
- Use the exact file paths from the list above
- Match the tech stack and patterns from the supervisor plan${agentId === 'frontend' && designSpec ? '\n- STRICTLY follow the Designer spec for all UI: layout, colors, spacing, animations, mobile breakpoints' : ''}`
}

function buildDesignerPrompt(
  taskDescription: string,
  supervisorPlan: string,
  frontendFilePaths: string[],
): string {
  const pageFiles = frontendFilePaths.filter(p =>
    p.includes('/page.') || p.includes('/layout.') || p.includes('/loading.') || p.includes('/error.')
  )
  const componentFiles = frontendFilePaths.filter(p =>
    p.includes('components/') || p.includes('Components/')
  )

  return `You are the Designer. Create a comprehensive design spec for ALL UI pages and components in this project.

TASK: ${taskDescription}

SUPERVISOR PLAN (summary):
${supervisorPlan.slice(0, 3000)}

PAGES TO DESIGN (${pageFiles.length}):
${pageFiles.map((p, i) => `${i + 1}. ${p}`).join('\n')}

COMPONENTS TO DESIGN (${componentFiles.length}):
${componentFiles.map((p, i) => `${i + 1}. ${p}`).join('\n')}

ALL FRONTEND FILES (${frontendFilePaths.length}):
${frontendFilePaths.join('\n')}

Create a SINGLE, COMPLETE design spec covering ALL pages and components above.
For each page and component, provide:
1. Layout Spec — wireframe, grid, hierarchy
2. Visual Spec — colors, fonts, borders, shadows, backgrounds
3. Component Spec — sizes, spacing, colors, hover/animation, mobile adaptation
4. Interaction Spec — hover, click, loading, empty, error states
5. Mobile Spec — breakpoints (375px, 768px), navigation, touch targets
6. Inspiration Reference — real website design patterns to follow

DESIGN SYSTEM DEFAULTS (use unless the task specifies otherwise):
- Background: dark theme (#0a0c16 base, rgba overlays)
- Accent: vibrant gradient (#7c6ef6 → #e8608c)
- Font: Inter for UI, DM Mono for code
- Border radius: 12-16px for cards, 8px for buttons
- Animations: subtle scale/opacity transitions (200-300ms)
- Glass morphism: backdrop-blur + rgba backgrounds

Output the complete design spec in plain English. DO NOT write any code.`
}

function buildFormatReminderPrompt(
  agentId: string,
  taskDescription: string,
  filePaths: string[],
  prevOutput: string,
): string {
  return `RETRY — Your previous output did not use the required file format.

You are the ${agentId} specialist for task: ${taskDescription}

You must generate these files: ${filePaths.join(', ')}

Your previous output (excerpt):
${prevOutput.slice(0, 400)}

The output did not contain valid --- FILE: --- blocks. You MUST use this EXACT format for EVERY file:

--- FILE: ${filePaths[0] || 'path/to/file.ts'} ---
\`\`\`typescript
// your complete code here
\`\`\`
--- END FILE ---

Now generate ALL ${filePaths.length} file${filePaths.length !== 1 ? 's' : ''} using this exact format. No prose, no explanations — just the FILE blocks.`
}

// BUG 4 FIX: Stricter reviewer validation
function buildReviewerPrompt(
  taskDescription: string,
  supervisorPlan: string,
  filePlan: FilePlan[],
  generatedFiles: Record<string, string>,
  designSpec?: string,
): string {
  const expectedPaths = filePlan.map(f => f.path)
  const generatedPaths = Object.keys(generatedFiles)
  const missingPaths = expectedPaths.filter(p => !generatedPaths.includes(p))

  // BUG 4: Detect stub/placeholder files
  const stubFiles: string[] = []
  const todoFiles: string[] = []
  const importIssues: string[] = []

  for (const [path, content] of Object.entries(generatedFiles)) {
    const lines = content.split('\n').filter(l => l.trim().length > 0)
    // Detect stub files (less than 3 non-empty lines for code files)
    const ext = path.split('.').pop() ?? ''
    if (['ts', 'tsx', 'js', 'jsx', 'sol'].includes(ext) && lines.length < 3) {
      stubFiles.push(`${path} (${lines.length} lines)`)
    }
    // Detect TODO/placeholder comments
    const todoCount = (content.match(/\/\/\s*TODO|\/\/\s*FIXME|\/\/\s*implement|\/\/\s*placeholder|\/\/\s*add .* here/gi) || []).length
    if (todoCount > 0) {
      todoFiles.push(`${path} (${todoCount} TODOs)`)
    }
    // Detect broken imports (files importing other generated files that don't exist)
    const importMatches = content.matchAll(/from\s+['"](@\/|\.\.?\/)([\w/.-]+)['"]/g)
    for (const im of importMatches) {
      const importPath = im[2].replace(/\.(ts|tsx|js|jsx)$/, '')
      // Check if the imported file exists in generated files
      const candidates = [
        importPath + '.ts', importPath + '.tsx', importPath + '/index.ts', importPath + '/index.tsx',
        importPath + '.js', importPath + '.jsx',
      ]
      const exists = candidates.some(c => {
        const fullPath = im[1] === '@/' ? c : c // simplified check
        return generatedPaths.some(gp => gp.endsWith(fullPath) || gp === fullPath)
      })
      if (!exists && im[1] === '@/') {
        importIssues.push(`${path} imports @/${im[2]} — not found`)
      }
    }
  }

  const fileContentsPreview = generatedPaths.slice(0, 25).map(path => {
    const content = generatedFiles[path] ?? ''
    const preview = content.slice(0, 500)
    return `=== ${path} (${content.split('\n').length} lines) ===\n${preview}${content.length > 500 ? '\n...(truncated)' : ''}`
  }).join('\n\n')

  const designCheckSection = designSpec
    ? `\nDESIGNER SPEC (Frontend code must match this):
${designSpec.slice(0, 4000)}

DESIGN COMPLIANCE CHECK:
- Does the Frontend code follow the Designer's layout spec?
- Are the correct colors, fonts, and spacing used?
- Are hover/click interactions implemented as specified?
- Are mobile breakpoints handled per the spec?
`
    : ''

  return `You are the Reviewer. Perform STRICT validation of completeness and code quality.

TASK: ${taskDescription}

EXPECTED FILES (${expectedPaths.length} total):
${expectedPaths.map(p => `- ${p}`).join('\n')}

GENERATED FILES (${generatedPaths.length} total):
${generatedPaths.map(p => `- ${p}`).join('\n')}
${designCheckSection}
${missingPaths.length > 0 ? `MISSING FILES (${missingPaths.length}):
${missingPaths.map(p => `- ${p}`).join('\n')}` : 'No missing files detected.'}

${stubFiles.length > 0 ? `STUB/EMPTY FILES (${stubFiles.length}):
${stubFiles.map(s => `- ${s}`).join('\n')}` : ''}

${todoFiles.length > 0 ? `FILES WITH TODO/PLACEHOLDER CODE (${todoFiles.length}):
${todoFiles.map(s => `- ${s}`).join('\n')}` : ''}

${importIssues.length > 0 ? `IMPORT ISSUES (${importIssues.length}):
${importIssues.slice(0, 15).map(s => `- ${s}`).join('\n')}` : ''}

GENERATED FILE CONTENTS (preview):
${fileContentsPreview}

COMPLETENESS VERIFICATION:
- Expected: ${expectedPaths.length} files
- Generated: ${generatedPaths.length} files
- Missing: ${missingPaths.length} files
- Stub files: ${stubFiles.length}
- Files with TODOs: ${todoFiles.length}

STRICT DECISION RULES (follow ALL):
1. If ANY expected file is missing → REJECTED
2. If ANY file has less than 3 lines of actual code → REJECTED (stub)
3. If more than 2 files contain TODO/placeholder comments → REJECTED
4. Only approve if ALL files are present AND have real, complete implementations
5. Never approve just because file count matches — check actual content
6. If a Designer spec was provided, verify Frontend code follows the design spec (layout, colors, spacing, animations, mobile breakpoints)

OUTPUT THIS EXACT FORMAT:

REVIEW_RESULT_START
Status: APPROVED
Expected: ${expectedPaths.length}
Generated: ${generatedPaths.length}
Missing: ${missingPaths.length}
Stubs: ${stubFiles.length}
TODOs: ${todoFiles.length}
REVIEW_RESULT_END

MISSING_FILES_START
${missingPaths.join('\n') || '(none)'}
MISSING_FILES_END

Findings:
[List specific code quality issues, interface mismatches, broken imports, or security concerns]

CRITICAL: Status MUST be REJECTED if Missing > 0 OR Stubs > 0 OR TODOs > 2. Never approve incomplete work.`
}

function buildMissingFilesPrompt(
  agentId: string,
  taskDescription: string,
  missingFiles: string[],
  supervisorPlan: string,
  existingFilePaths: string[],
): string {
  return `You are the ${agentId} specialist. The Reviewer rejected the work — these files are missing:

${missingFiles.map((f, i) => `${i + 1}. ${f}`).join('\n')}

TASK: ${taskDescription}

SUPERVISOR PLAN (summary):
${supervisorPlan.slice(0, 2000)}

Files already generated (do NOT regenerate):
${existingFilePaths.join('\n')}

Generate ONLY the ${missingFiles.length} missing file${missingFiles.length !== 1 ? 's' : ''} listed above.

Use this EXACT format for each file:

--- FILE: path/to/file.ext ---
\`\`\`typescript
// complete production-ready code
\`\`\`
--- END FILE ---

No placeholders. No TODOs. Complete working implementations only.`
}

// ─── ORCHESTRATION ENGINE ────────────────────────────────────────────
interface RepoOverride {
  owner: string
  repo: string
}

async function runPipeline(
  taskDescription: string,
  dispatch: React.Dispatch<AppAction>,
  repoOverride?: RepoOverride,
) {
  dispatch({ type: 'SET_RUNNING', value: true })
  dispatch({ type: 'RESET_AGENTS' })
  dispatch({ type: 'MERGE_PARSED_FILES', files: {} }) // Reset files

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
    model: string,
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

  // Collect all agent text outputs for the GitHub push at the end
  const allAgentOutputs: string[] = []

  // BUG 1 FIX: continuation on truncation (max 2 continuations)
  const MAX_CONTINUATIONS = 2

  const callAgent = async (
    agentId: string,
    userMessage: string,
    expectedFiles?: string[],
  ): Promise<{ text: string; error?: string }> => {
    const agentDef = AGENTS.find(a => a.id === agentId)!
    dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'working', startedAt: Date.now(), progress: 10 } })

    let progress = 10
    const progressInterval = setInterval(() => {
      progress = Math.min(90, progress + Math.floor(Math.random() * 8) + 2)
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { progress } })
    }, 2000)

    try {
      let fullText = ''
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let continuations = 0

      // Initial call
      const result = await callAnthropicViaServer(agentDef.model, agentId, userMessage)
      fullText = result.text
      totalInputTokens += result.inputTokens
      totalOutputTokens += result.outputTokens

      // BUG 1: If response was truncated (max_tokens), auto-continue
      while (result.stopReason === 'max_tokens' && continuations < MAX_CONTINUATIONS) {
        continuations++
        await addLog(agentId, 'info', `Output truncated — continuation ${continuations}/${MAX_CONTINUATIONS}`)

        const continuePrompt = `Your previous response was truncated. Here is what you output so far:\n\n${fullText.slice(-2000)}\n\nContinue EXACTLY where you left off. Do NOT repeat any files already output. Continue outputting the remaining files using the --- FILE: --- format.`
        const contResult = await callAnthropicViaServer(agentDef.model, agentId, continuePrompt)
        fullText += '\n' + contResult.text
        totalInputTokens += contResult.inputTokens
        totalOutputTokens += contResult.outputTokens

        if (contResult.stopReason !== 'max_tokens') break
      }

      // BUG 2: Missing file detection and auto follow-up (max 2 rounds)
      if (expectedFiles && expectedFiles.length > 0) {
        const MAX_FOLLOWUP_ROUNDS = 2
        for (let round = 0; round < MAX_FOLLOWUP_ROUNDS; round++) {
          const parsed = parseFileContents(fullText)
          const generatedPaths = Object.keys(parsed)
          const missing = expectedFiles.filter(f => !generatedPaths.includes(f))

          if (missing.length === 0) break

          await addLog(agentId, 'warn', `Missing ${missing.length} file(s) — auto follow-up round ${round + 1}`)
          const followUp = buildMissingFilesPrompt(agentId, taskDescription, missing, supervisorPlan, generatedPaths)
          const followResult = await callAnthropicViaServer(agentDef.model, agentId, followUp)
          fullText += '\n' + followResult.text
          totalInputTokens += followResult.inputTokens
          totalOutputTokens += followResult.outputTokens
        }
      }

      clearInterval(progressInterval)
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'done', progress: 100 } })

      const fileContents = parseFileContents(fullText)
      const fileKeys = Object.keys(fileContents)
      if (fileKeys.length > 0) {
        dispatch({ type: 'MERGE_PARSED_FILES', files: fileContents })
      }
      dispatch({
        type: 'SET_AGENT_OUTPUT',
        id: agentId,
        output: fullText,
        files: fileKeys.length > 0 ? fileKeys : parseFilePaths(fullText),
      })

      const cost = await recordCost(agentId, totalInputTokens, totalOutputTokens, agentDef.model)
      const filesGenerated = fileKeys.length
      const filesSuffix = filesGenerated > 0 ? ` — ${filesGenerated} file${filesGenerated !== 1 ? 's' : ''}` : ''
      const contSuffix = continuations > 0 ? ` (${continuations} cont.)` : ''
      await addLog(agentId, 'success', `Done${filesSuffix}${contSuffix} · ${(totalInputTokens + totalOutputTokens).toLocaleString()} tok · $${cost.toFixed(4)}`)

      await fetch('/api/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'agent:done', data: { taskId, agentId, inputTokens: totalInputTokens, outputTokens: totalOutputTokens } }),
      }).catch(() => null)

      if (fullText.trim().length > 0) {
        allAgentOutputs.push(fullText)
      }

      return { text: fullText }
    } catch (err) {
      clearInterval(progressInterval)
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'error', progress: 0 } })
      await addLog(agentId, 'error', `Error: ${errMsg}`)
      return { text: '', error: errMsg }
    }
  }

  // ── PHASE 1: Supervisor → Canonical Spec + FILE_PLAN ─────────────
  dispatch({
    type: 'SET_PIPELINE',
    pipeline: [
      { id: 'plan', label: 'Planning', agent: 'supervisor', status: 'working' },
      { id: 'design', label: 'Design', agent: 'designer', status: 'idle' },
      { id: 'implement', label: 'Implement', agent: 'backend', status: 'idle' },
      { id: 'review', label: 'Review', agent: 'reviewer', status: 'idle' },
      { id: 'deliver', label: 'Deliver', agent: 'supervisor', status: 'idle' },
    ],
  })

  await addLog('supervisor', 'delegate', `New task: "${taskDescription.slice(0, 80)}"`)
  const planResult = await callAgent('supervisor', buildSupervisorPrompt(taskDescription))

  if (planResult.error) {
    dispatch({ type: 'UPDATE_TASK', id: taskId, data: { status: 'error' } })
    dispatch({ type: 'SET_RUNNING', value: false })
    return
  }

  dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'plan', data: { status: 'done' } })

  const supervisorPlan = planResult.text
  const filePlan = parseSupervisorFilePlan(supervisorPlan)
  const totalExpected = filePlan.length

  dispatch({ type: 'SET_TOTAL_EXPECTED', count: totalExpected })

  // Hoist generatedFiles so it's accessible in Phase 4
  const generatedFiles: Record<string, string> = {}

  // ── PHASE 1.5: Designer → Design Spec (only if UI pages exist) ────
  const frontendFiles = filePlan.filter(f => f.agent === 'frontend')
  const hasFrontend = frontendFiles.length > 0
  let designSpec: string | undefined

  if (hasFrontend) {
    dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'design', data: { status: 'working' } })
    const frontendPaths = frontendFiles.map(f => f.path)
    await addLog('supervisor', 'delegate', `→ designer: Design spec for ${frontendPaths.length} frontend files`)

    dispatch({ type: 'UPDATE_AGENT', id: 'designer', data: { status: 'working', currentTask: `Designing ${frontendPaths.length} pages/components` } })

    const designerResult = await callAgent(
      'designer',
      buildDesignerPrompt(taskDescription, supervisorPlan, frontendPaths),
    )

    if (designerResult.text.trim().length > 0) {
      designSpec = designerResult.text
      await addLog('designer', 'success', `Design spec created — ${designSpec.length} chars`)
    } else {
      await addLog('designer', 'warn', 'Designer returned empty spec — Frontend will proceed without design guidance')
    }
    dispatch({ type: 'UPDATE_AGENT', id: 'designer', data: { currentTask: null } })
    dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'design', data: { status: 'done' } })
  } else {
    await addLog('supervisor', 'info', 'No frontend files — skipping Designer')
    dispatch({ type: 'UPDATE_AGENT', id: 'designer', data: { status: 'done', progress: 100 } })
    dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'design', data: { status: 'done' } })
  }

  if (totalExpected === 0) {
    await addLog('supervisor', 'warn', 'No FILE_PLAN found — falling back to keyword-based delegation')
    // Fallback: keyword detection
    const lower = taskDescription.toLowerCase()
    const needsWeb3 = /contract|token|staking|erc|solidity|web3|blockchain|nft|defi/.test(lower)
    const needsFrontend = /page|ui|component|frontend|dashboard|form|button|display|react|tsx/.test(lower)
    const needsBackend = /api|server|database|endpoint|auth|backend|deploy|docker|prisma|express/.test(lower)
    const agentsToRun: string[] = []
    if (needsWeb3) agentsToRun.push('web3')
    if (needsBackend || !needsFrontend) agentsToRun.push('backend')
    if (needsFrontend || !needsBackend) agentsToRun.push('frontend')
    if (agentsToRun.length === 0) agentsToRun.push('backend', 'frontend')

    const fallbackPromises = agentsToRun.map(async agentId => {
      await addLog('supervisor', 'delegate', `→ ${agentId}: Implement ${agentId} portion`)
      const prompt = `Supervisor plan:\n${supervisorPlan}\n\nImplement the ${agentId} portion of: "${taskDescription}"\n\nOutput ALL files using this format:\n--- FILE: path/to/file.ext ---\n\`\`\`typescript\ncode\n\`\`\`\n--- END FILE ---`
      return callAgent(agentId, prompt)
    })
    const fallbackResults = await Promise.all(fallbackPromises)
    // Collect generated files from fallback
    for (const r of fallbackResults) {
      Object.assign(generatedFiles, parseFileContents(r.text))
    }
  } else {
    await addLog('supervisor', 'info', `FILE_PLAN: ${totalExpected} files across ${new Set(filePlan.map(f => f.batch)).size} batches`)

    // ── PHASE 2: Multi-round batch implementation ─────────────────

    // Group files by batch number
    const batchMap = new Map<number, FilePlan[]>()
    for (const file of filePlan) {
      const batch = batchMap.get(file.batch) ?? []
      batch.push(file)
      batchMap.set(file.batch, batch)
    }

    const sortedBatches = [...batchMap.entries()].sort((a, b) => a[0] - b[0])

    // Update pipeline to show all unique agents
    const uniqueAgents = [...new Set(filePlan.map(f => f.agent))]
    const dynamicPipeline: PipelineStep[] = [
      { id: 'plan', label: 'Plan', agent: 'supervisor', status: 'done' as const },
      { id: 'design', label: 'Design', agent: 'designer', status: 'done' as const },
      ...uniqueAgents.map(id => ({
        id,
        label: AGENTS.find(a => a.id === id)?.name ?? id,
        agent: id,
        status: 'waiting' as const,
      })),
      { id: 'review', label: 'Review', agent: 'reviewer', status: 'waiting' as const },
      { id: 'deliver', label: 'Deliver', agent: 'supervisor', status: 'idle' as const },
    ]
    dispatch({ type: 'SET_PIPELINE', pipeline: dynamicPipeline })

    for (const [batchNum, batchFiles] of sortedBatches) {
      // Group by agent within this batch
      const agentMap = new Map<string, FilePlan[]>()
      for (const file of batchFiles) {
        const list = agentMap.get(file.agent) ?? []
        list.push(file)
        agentMap.set(file.agent, list)
      }

      // BUG 3 FIX: Track completed agents to prevent re-assignment
      // Run each agent in this batch (parallel across agents within the same batch)
      const agentResults = await Promise.all([...agentMap.entries()].map(async ([agentId, agentFiles]) => {
        dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: agentId, data: { status: 'working' } })
        dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { currentTask: `Batch ${batchNum}: ${agentFiles.length} files` } })
        const agentNewFiles: Record<string, string> = {}

        // Split into sub-batches of MAX_FILES_PER_CALL
        for (let i = 0; i < agentFiles.length; i += MAX_FILES_PER_CALL) {
          const subBatch = agentFiles.slice(i, i + MAX_FILES_PER_CALL)
          const filePaths = subBatch.map((f: FilePlan) => f.path)
          const subBatchLabel = `batch ${batchNum}${agentFiles.length > MAX_FILES_PER_CALL ? ` (${Math.floor(i / MAX_FILES_PER_CALL) + 1}/${Math.ceil(agentFiles.length / MAX_FILES_PER_CALL)})` : ''}`

          await addLog(
            'supervisor',
            'delegate',
            `→ ${agentId}: ${subBatchLabel} — ${filePaths.join(', ')}`,
          )

          const prompt = buildBatchPrompt(
            agentId,
            taskDescription,
            filePaths,
            supervisorPlan,
            Object.keys(generatedFiles),
            designSpec,
          )

          // Pass expectedFiles for auto follow-up (BUG 2)
          const result = await callAgent(agentId, prompt, filePaths)

          // Verify format compliance
          const parsed = parseFileContents(result.text)
          if (Object.keys(parsed).length === 0 && result.text.trim().length > 100) {
            await addLog(agentId, 'warn', `File format not followed for ${subBatchLabel} — retrying`)
            const retryPrompt = buildFormatReminderPrompt(agentId, taskDescription, filePaths, result.text)
            const retryResult = await callAgent(agentId, retryPrompt, filePaths)
            Object.assign(agentNewFiles, parseFileContents(retryResult.text))
          } else {
            Object.assign(agentNewFiles, parsed)
          }
        }

        dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: agentId, data: { status: 'done' } })
        dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { currentTask: null } })
        return agentNewFiles
      }))

      // Merge all agent results after parallel execution completes (no race condition)
      for (const newFiles of agentResults) {
        Object.assign(generatedFiles, newFiles)
      }
      dispatch({ type: 'MERGE_PARSED_FILES', files: generatedFiles })

      // Log progress after each batch
      const done = Object.keys(generatedFiles).length
      const pct = totalExpected > 0 ? Math.round((done / totalExpected) * 100) : 0
      await addLog('system', 'info', `Files: ${done}/${totalExpected} (${pct}%)`)
    }

    // ── PHASE 3: Reviewer completeness check (max 2 cycles) ──────
    dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'review', data: { status: 'working' } })
    dispatch({ type: 'UPDATE_AGENT', id: 'reviewer', data: { status: 'reviewing' } })

    let reviewCycle = 0
    const MAX_REVIEW_CYCLES = 2
    let finalApproved = false

    while (reviewCycle < MAX_REVIEW_CYCLES) {
      const currentGenerated = Object.keys(generatedFiles)
      await addLog(
        'supervisor',
        'delegate',
        `→ reviewer: Cycle ${reviewCycle + 1} — checking ${currentGenerated.length}/${totalExpected} files`,
      )

      const reviewPrompt = buildReviewerPrompt(
        taskDescription,
        supervisorPlan,
        filePlan,
        generatedFiles,
        designSpec,
      )

      const reviewResult = await callAgent('reviewer', reviewPrompt)
      const { approved, missingFiles } = parseReviewResult(reviewResult.text)

      if (approved) {
        await addLog('reviewer', 'success', `APPROVED — ${currentGenerated.length}/${totalExpected} files verified`)
        finalApproved = true
        break
      }

      // Reviewer rejected
      const actualMissing = missingFiles.filter(f => !generatedFiles[f])
      const missing = actualMissing.length > 0
        ? actualMissing
        : filePlan.map(f => f.path).filter(p => !generatedFiles[p])

      await addLog(
        'reviewer',
        'warn',
        `REJECTED (cycle ${reviewCycle + 1}/${MAX_REVIEW_CYCLES}) — ${missing.length} files missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
      )

      if (missing.length === 0) {
        if (reviewCycle === MAX_REVIEW_CYCLES - 1) {
          await addLog('reviewer', 'warn', 'Max cycles reached — proceeding with current files')
          break
        }
      }

      if (reviewCycle === MAX_REVIEW_CYCLES - 1) {
        await addLog('reviewer', 'warn', `Max review cycles (${MAX_REVIEW_CYCLES}) reached — proceeding`)
        break
      }

      // Re-delegate missing files to their assigned agents
      if (missing.length > 0) {
        const missingByAgent = new Map<string, string[]>()
        for (const path of missing) {
          const planned = filePlan.find(f => f.path === path)
          const agentId = planned?.agent ?? 'backend'
          const list = missingByAgent.get(agentId) ?? []
          list.push(path)
          missingByAgent.set(agentId, list)
        }

        await Promise.all([...missingByAgent.entries()].map(async ([agentId, files]) => {
          await addLog('supervisor', 'delegate', `→ ${agentId}: Generate ${files.length} missing files`)
          const prompt = buildMissingFilesPrompt(
            agentId,
            taskDescription,
            files,
            supervisorPlan,
            Object.keys(generatedFiles),
          )
          const result = await callAgent(agentId, prompt)
          Object.assign(generatedFiles, parseFileContents(result.text))
          dispatch({ type: 'MERGE_PARSED_FILES', files: generatedFiles })
        }))

        const newDone = Object.keys(generatedFiles).length
        const newPct = totalExpected > 0 ? Math.round((newDone / totalExpected) * 100) : 0
        await addLog('system', 'info', `Files after revision: ${newDone}/${totalExpected} (${newPct}%)`)
      }

      reviewCycle++
    }

    dispatch({
      type: 'UPDATE_PIPELINE_STEP',
      stepId: 'review',
      data: { status: finalApproved ? 'done' : 'error' },
    })
  }

  // ── PHASE 4: Deliver + Validate + Push ──────────────────────────────
  dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'deliver', data: { status: 'working' } })

  // BUG 8 FIX: File validation before push
  const finalFiles = generatedFiles
  const finalPaths = Object.keys(finalFiles)
  const validationIssues: string[] = []

  // Check for package.json
  const pkgJson = finalFiles['package.json']
  if (!pkgJson) {
    validationIssues.push('Missing package.json')
  } else {
    try {
      const pkg = JSON.parse(pkgJson)
      if (!pkg.dependencies && !pkg.devDependencies) {
        validationIssues.push('package.json has no dependencies')
      }
    } catch {
      validationIssues.push('package.json is invalid JSON')
    }
  }

  // Check for tsconfig.json
  if (!finalFiles['tsconfig.json'] && finalPaths.some(p => p.endsWith('.ts') || p.endsWith('.tsx'))) {
    validationIssues.push('Missing tsconfig.json for TypeScript project')
  }

  // ── IMPORT RESOLUTION CHECK ────────────────────────────────────────
  // Resolve every import in every .ts/.tsx/.js/.jsx file against the file list.
  // If an import doesn't resolve → block the push and send back for fixing.

  interface BrokenImport {
    file: string
    importSpecifier: string
    resolvedAs: string // what we looked for
    suggestion: string // closest match in file list, if any
  }

  function resolveImport(
    importingFile: string,
    specifier: string,
    allPaths: string[],
  ): { resolved: boolean; tried: string; suggestion: string } {
    let basePath: string

    if (specifier.startsWith('@/')) {
      // Alias import: @/components/Foo → components/Foo
      basePath = specifier.slice(2)
    } else {
      // Relative import: ./Foo or ../Foo — resolve relative to importing file's directory
      const dir = importingFile.includes('/') ? importingFile.slice(0, importingFile.lastIndexOf('/')) : ''
      const parts = (dir ? dir + '/' + specifier : specifier).split('/')
      const resolved: string[] = []
      for (const part of parts) {
        if (part === '.') continue
        else if (part === '..') resolved.pop()
        else resolved.push(part)
      }
      basePath = resolved.join('/')
    }

    // Strip extension if already provided
    const stripped = basePath.replace(/\.(ts|tsx|js|jsx)$/, '')

    // Candidates to check (in priority order)
    const candidates = [
      stripped + '.ts',
      stripped + '.tsx',
      stripped + '.js',
      stripped + '.jsx',
      stripped + '/index.ts',
      stripped + '/index.tsx',
      stripped + '/index.js',
      stripped + '/index.jsx',
      stripped, // exact match (e.g., .json, .css, .svg)
    ]

    for (const c of candidates) {
      if (allPaths.includes(c)) {
        return { resolved: true, tried: stripped, suggestion: '' }
      }
    }

    // Find closest match for suggestion
    const baseName = stripped.split('/').pop() ?? stripped
    const matches = allPaths.filter(p => {
      const pName = p.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') ?? ''
      return pName === baseName
    })
    const suggestion = matches.length > 0 ? matches[0] : ''

    return { resolved: false, tried: stripped, suggestion }
  }

  const codeFiles = finalPaths.filter(p => /\.(ts|tsx|js|jsx)$/.test(p))
  const brokenImports: BrokenImport[] = []

  for (const filePath of codeFiles) {
    const content = finalFiles[filePath]
    // Match: from '@/...', from './...', from '../...'
    const importRegex = /from\s+['"]((?:@\/|\.\.?\/)[^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = importRegex.exec(content)) !== null) {
      const specifier = match[1]

      // Skip non-code imports (css, scss, svg, json, images)
      if (/\.(css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|ico|json|woff|woff2|ttf|eot)$/.test(specifier)) continue

      const result = resolveImport(filePath, specifier, finalPaths)
      if (!result.resolved) {
        brokenImports.push({
          file: filePath,
          importSpecifier: specifier,
          resolvedAs: result.tried,
          suggestion: result.suggestion,
        })
      }
    }
  }

  if (brokenImports.length > 0) {
    validationIssues.push(`${brokenImports.length} broken imports`)

    // Log each broken import with details
    for (const bi of brokenImports.slice(0, 20)) {
      const suggestionHint = bi.suggestion ? ` (did you mean ${bi.suggestion}?)` : ''
      await addLog(
        'supervisor',
        'error',
        `Build would fail: ${bi.file} imports "${bi.importSpecifier}" but no file resolves at ${bi.resolvedAs}${suggestionHint}`,
      )
    }
    if (brokenImports.length > 20) {
      await addLog('supervisor', 'error', `…and ${brokenImports.length - 20} more broken imports`)
    }
  }

  if (validationIssues.length > 0) {
    await addLog('supervisor', 'warn', `Validation: ${validationIssues.join('; ')}`)
  } else {
    await addLog('supervisor', 'success', `Validation passed — ${finalPaths.length} files ready`)
  }

  // ── IMPORT FIX CYCLE: Send broken imports back to Frontend for fixing ──
  const MAX_IMPORT_FIX_CYCLES = 2
  let importFixCycle = 0

  while (brokenImports.length > 0 && importFixCycle < MAX_IMPORT_FIX_CYCLES) {
    importFixCycle++
    await addLog('supervisor', 'info', `Import fix cycle ${importFixCycle}/${MAX_IMPORT_FIX_CYCLES} — ${brokenImports.length} broken imports`)

    // Group broken imports by the agent that owns the importing file
    const fixByAgent = new Map<string, BrokenImport[]>()
    for (const bi of brokenImports) {
      // Determine agent: check if file is in the filePlan, otherwise guess from path
      const planned = filePlan.find(f => f.path === bi.file)
      const agentId = planned?.agent ?? (bi.file.includes('api/') ? 'backend' : 'frontend')
      const list = fixByAgent.get(agentId) ?? []
      list.push(bi)
      fixByAgent.set(agentId, list)
    }

    await Promise.all([...fixByAgent.entries()].map(async ([agentId, issues]) => {
      const issueList = issues.map(bi => {
        const suggestionHint = bi.suggestion
          ? `\n   → Suggested fix: change import to "${bi.suggestion.replace(/\.(ts|tsx)$/, '').replace(/^/, '@/')}"`
          : `\n   → No matching file found — create it or fix the import path`
        return `- ${bi.file} imports "${bi.importSpecifier}" → resolves to "${bi.resolvedAs}" which does NOT exist${suggestionHint}`
      }).join('\n')

      const availableFiles = finalPaths
        .filter(p => /\.(ts|tsx|js|jsx)$/.test(p))
        .join('\n')

      const fixPrompt = `IMPORT PATH FIX — The build will fail because of broken imports.

Fix these ${issues.length} broken import${issues.length !== 1 ? 's' : ''}:
${issueList}

ALL available files in the project:
${availableFiles}

For each broken import, either:
A) Fix the import path to point to the correct existing file
B) Create the missing file if it should exist

Output ONLY the files that need changes using the standard format:

--- FILE: path/to/file.ext ---
\`\`\`typescript
// complete corrected code
\`\`\`
--- END FILE ---

RULES:
- Fix ALL broken imports listed above
- Use exact paths from the available files list
- If a file is missing, create it with complete implementation
- Do NOT change any other code — only fix imports or create missing files`

      await addLog('supervisor', 'delegate', `→ ${agentId}: Fix ${issues.length} broken imports`)
      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'working', currentTask: `Fixing ${issues.length} broken imports` } })

      const fixResult = await callAgent(agentId, fixPrompt)
      const fixedFiles = parseFileContents(fixResult.text)

      if (Object.keys(fixedFiles).length > 0) {
        Object.assign(generatedFiles, fixedFiles)
        Object.assign(finalFiles, fixedFiles)
        dispatch({ type: 'MERGE_PARSED_FILES', files: generatedFiles })
        await addLog(agentId, 'success', `Fixed ${Object.keys(fixedFiles).length} files`)
      }

      dispatch({ type: 'UPDATE_AGENT', id: agentId, data: { status: 'done', currentTask: null } })
    }))

    // Re-check imports after fixes
    const updatedPaths = Object.keys(finalFiles)
    brokenImports.length = 0 // clear

    for (const filePath of updatedPaths.filter(p => /\.(ts|tsx|js|jsx)$/.test(p))) {
      const content = finalFiles[filePath]
      const importRegex = /from\s+['"]((?:@\/|\.\.?\/)[^'"]+)['"]/g
      let m: RegExpExecArray | null
      while ((m = importRegex.exec(content)) !== null) {
        const specifier = m[1]
        if (/\.(css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|ico|json|woff|woff2|ttf|eot)$/.test(specifier)) continue
        const result = resolveImport(filePath, specifier, updatedPaths)
        if (!result.resolved) {
          brokenImports.push({
            file: filePath,
            importSpecifier: specifier,
            resolvedAs: result.tried,
            suggestion: result.suggestion,
          })
        }
      }
    }

    if (brokenImports.length === 0) {
      await addLog('supervisor', 'success', `All imports resolved after fix cycle ${importFixCycle}`)
    } else {
      await addLog('supervisor', 'warn', `${brokenImports.length} broken imports remain after fix cycle ${importFixCycle}`)
    }
  }

  // Final decision: block push if imports still broken
  const pushBlocked = brokenImports.length > 0

  if (pushBlocked) {
    await addLog('supervisor', 'error', `Push BLOCKED — ${brokenImports.length} unresolved imports would cause build failure`)
    for (const bi of brokenImports.slice(0, 10)) {
      await addLog('supervisor', 'error', `  ✗ ${bi.file} → "${bi.importSpecifier}" (not found)`)
    }
  }

  dispatch({ type: 'UPDATE_PIPELINE_STEP', stepId: 'deliver', data: { status: pushBlocked ? 'error' : 'done' } })
  dispatch({ type: 'UPDATE_AGENT', id: 'supervisor', data: { status: pushBlocked ? 'error' : 'done' } })

  const finalPathsUpdated = Object.keys(finalFiles)
  dispatch({ type: 'UPDATE_TASK', id: taskId, data: { status: pushBlocked ? 'error' : 'completed', result: pushBlocked ? `Blocked: ${brokenImports.length} unresolved imports` : `Generated ${finalPathsUpdated.length}/${totalExpected} files` } })
  await addLog('supervisor', pushBlocked ? 'error' : 'success', pushBlocked ? `Task blocked — ${brokenImports.length} broken imports prevent push` : `Task complete — ${finalPathsUpdated.length}/${totalExpected} files generated`)

  await fetch('/api/tasks/' + taskId, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: pushBlocked ? 'error' : 'completed', result: pushBlocked ? `Blocked: ${brokenImports.length} unresolved imports` : planResult.text.slice(0, 2000) }),
  }).catch(() => null)

  await fetch('/api/emit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event: 'task:complete', data: { taskId, title: taskDescription } }),
  }).catch(() => null)

  if (pushBlocked) {
    dispatch({ type: 'SET_TAB', tab: 'logs' })
    dispatch({ type: 'SET_RUNNING', value: false })
    return
  }

  // ── AUTO-PUSH: Send all generated files to GitHub ────────────────────
  try {
    await addLog('supervisor', 'info', `Pushing ${finalPathsUpdated.length} files to GitHub…`)
    const pushRes = await fetch('/api/github/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: finalPathsUpdated.map(p => ({ path: p, content: finalFiles[p] })),
        message: `feat: ${taskDescription.slice(0, 72)}`,
        ...(repoOverride && { owner: repoOverride.owner, repo: repoOverride.repo }),
      }),
    })
    const pushData = await pushRes.json() as {
      ok: boolean
      skipped?: boolean
      filesCount?: number
      agentFilesCount?: number
      commitSha?: string
      commitUrl?: string
      isInitialCommit?: boolean
      error?: string
    }

    if (pushData.ok && !pushData.skipped) {
      const initNote = pushData.isInitialCommit ? ' (initial commit + scaffolding)' : ''
      await addLog(
        'supervisor',
        'success',
        `Pushed ${pushData.filesCount} files${initNote} · ${pushData.commitSha} — ${pushData.commitUrl}`,
      )
      await addLog('supervisor', 'info', 'Railway will auto-deploy in ~2 minutes')
    } else if (pushData.skipped) {
      await addLog('supervisor', 'info', 'GitHub push skipped — no files and repo already initialized')
    } else {
      await addLog('supervisor', 'warn', `GitHub push failed: ${pushData.error}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await addLog('supervisor', 'warn', `GitHub push failed: ${msg}`)
  }

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
  const [isPushing, setIsPushing] = useState(false)
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
        // Use dedup action to prevent double-logging (addLog dispatches locally AND server re-emits via socket)
        dispatch({ type: 'ADD_LOG_DEDUP', log: { ...data, ts: data.ts ?? Date.now() } })
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
    async (taskDesc: string, repoOverride?: RepoOverride) => {
      if (state.isRunning) return
      await runPipeline(taskDesc, dispatch, repoOverride)
    },
    [state.isRunning]
  )

  const handleManualPush = useCallback(async () => {
    const fileEntries = Object.entries(state.parsedFiles)
    if (fileEntries.length === 0) {
      // Fallback: use raw agent outputs if parsedFiles is empty
      const outputs = Object.values(state.agents).map(a => a.output).filter(Boolean)
      if (outputs.length === 0) return
    }
    setIsPushing(true)
    dispatch({ type: 'ADD_LOG', log: { agent: 'supervisor', type: 'info', message: 'Manual GitHub push triggered…' } })
    try {
      const taskTitle = state.tasks[0]?.title ?? 'manual push'
      const body = fileEntries.length > 0
        ? { files: fileEntries.map(([path, content]) => ({ path, content })), message: `feat: ${taskTitle.slice(0, 72)}` }
        : { rawOutputs: Object.values(state.agents).map(a => a.output).filter(Boolean), message: `feat: ${taskTitle.slice(0, 72)}` }

      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as {
        ok: boolean; skipped?: boolean; filesCount?: number
        commitSha?: string; commitUrl?: string; error?: string; isInitialCommit?: boolean
      }
      if (data.ok && !data.skipped) {
        const initNote = data.isInitialCommit ? ' (initial commit with scaffolding)' : ''
        dispatch({ type: 'ADD_LOG', log: { agent: 'supervisor', type: 'success', message: `Pushed ${data.filesCount} files${initNote} · ${data.commitSha} — ${data.commitUrl}` } })
        dispatch({ type: 'ADD_LOG', log: { agent: 'supervisor', type: 'info', message: '🚀 Railway will auto-deploy in ~2 minutes' } })
        dispatch({ type: 'SET_TAB', tab: 'logs' })
      } else if (data.skipped) {
        dispatch({ type: 'ADD_LOG', log: { agent: 'supervisor', type: 'info', message: 'GitHub push: no file blocks detected in output' } })
      } else {
        dispatch({ type: 'ADD_LOG', log: { agent: 'supervisor', type: 'error', message: `GitHub push failed: ${data.error}` } })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown'
      dispatch({ type: 'ADD_LOG', log: { agent: 'supervisor', type: 'error', message: `GitHub push error: ${msg}` } })
    } finally {
      setIsPushing(false)
    }
  }, [state.parsedFiles, state.agents, state.tasks])

  // ── Missing key screen ───────────────────────────────────────────
  if (keyMissing) {
    return <MissingKeyBanner />
  }

  // ── Derived stats ────────────────────────────────────────────────
  const activeCount = Object.values(state.agents).filter(a => a.status === 'working').length
  const doneCount = Object.values(state.agents).filter(a => a.status === 'done').length
  const totalCost = Object.values(state.costs).reduce((s, c) => s + c.costUsd, 0)
  const fileCount = Object.keys(state.parsedFiles).length
  const tabs: Array<{ id: AppState['tab']; label: string; count?: number }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'logs', label: 'Live Logs', count: state.logs.length },
    { id: 'files', label: 'Files', count: fileCount > 0 ? fileCount : undefined },
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
            {doneCount > 0 && !state.isRunning && (
              <button
                onClick={handleManualPush}
                disabled={isPushing}
                title="Push latest agent output to GitHub"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px',
                  background: isPushing ? 'rgba(55,65,81,0.4)' : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${isPushing ? 'rgba(55,65,81,0.4)' : 'rgba(16,185,129,0.2)'}`,
                  borderRadius: 8,
                  color: isPushing ? '#4b5563' : '#10b981',
                  fontSize: 10.5, fontWeight: 500,
                  cursor: isPushing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                {isPushing ? (
                  <>
                    <div style={{ width: 8, height: 8, border: '1.5px solid #4b5563', borderTopColor: '#6b7280', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Pushing…
                  </>
                ) : (
                  '⬆ Push to GitHub'
                )}
              </button>
            )}
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
            { label: 'Active', value: `${activeCount}/6`, color: '#7c6ef6' },
            { label: 'Done', value: `${doneCount}/6`, color: '#10b981' },
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
          gridTemplateColumns: 'repeat(6, 1fr)',
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
            padding: state.tab === 'logs' || state.tab === 'summary' || state.tab === 'files' ? 0 : '14px 16px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {state.tab === 'summary' && (
              <SummaryView
                agents={AGENTS}
                agentStates={state.agents}
                costs={state.costs}
                isRunning={state.isRunning}
                totalExpectedFiles={state.totalExpectedFiles}
                generatedFileCount={Object.keys(state.parsedFiles).length}
              />
            )}
            {state.tab === 'logs' && (
              <LogViewer logs={state.logs} agents={AGENTS} />
            )}
            {state.tab === 'files' && (
              <FilesView
                files={state.parsedFiles}
                isRunning={state.isRunning}
                onFileEdit={(path, content) =>
                  dispatch({ type: 'MERGE_PARSED_FILES', files: { [path]: content } })
                }
              />
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
          <span>6 agents · Supervisor pattern · Anthropic API · Socket.io · Prisma SQLite</span>
          <span>claude-sonnet-4-6 + claude-opus-4-6</span>
        </div>
      </div>
    </div>
  )
}
