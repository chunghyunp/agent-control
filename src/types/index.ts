export interface AgentDef {
  id: string
  name: string
  icon: string
  model: string
  role: string
  color: string
  costIn: number  // USD per 1M input tokens
  costOut: number // USD per 1M output tokens
}

export interface AgentState {
  status: 'idle' | 'working' | 'waiting' | 'done' | 'error' | 'reviewing'
  progress: number
  currentTask: string | null
  tokensIn: number
  tokensOut: number
  startedAt: number | null
  output: string       // full text response
  files: string[]      // parsed file paths from output
}

export interface PipelineStep {
  id: string
  label: string
  agent: string
  status: 'idle' | 'working' | 'waiting' | 'done' | 'error'
}

export interface LogEntry {
  id?: number | string
  ts: number
  agent: string
  type: 'info' | 'success' | 'error' | 'delegate' | 'warn'
  message: string
}

export interface CostEntry {
  agent: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface Task {
  id: string
  title: string
  status: 'pending' | 'active' | 'completed' | 'error'
  result?: string
  created: string
}

export interface AppState {
  tasks: Task[]
  activeTaskId: string | null
  agents: Record<string, AgentState>
  pipeline: PipelineStep[] | null
  logs: LogEntry[]
  costs: Record<string, CostEntry>
  isRunning: boolean
  taskInput: string
  tab: 'summary' | 'logs' | 'costs' | 'tasks'
}

export type AppAction =
  | { type: 'SET_AGENT_STATUS'; id: string; status: AgentState['status'] }
  | { type: 'UPDATE_AGENT'; id: string; data: Partial<AgentState> }
  | { type: 'ADD_LOG'; log: Omit<LogEntry, 'ts'> & { ts?: number } }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; id: string; data: Partial<Task> }
  | { type: 'SET_PIPELINE'; pipeline: PipelineStep[] }
  | { type: 'UPDATE_PIPELINE_STEP'; stepId: string; data: Partial<PipelineStep> }
  | { type: 'SET_RUNNING'; value: boolean }
  | { type: 'UPDATE_COST'; agent: string; inputTokens: number; outputTokens: number; costUsd: number }
  | { type: 'RESET_AGENTS' }
  | { type: 'SET_TAB'; tab: AppState['tab'] }
  | { type: 'SET_AGENT_OUTPUT'; id: string; output: string; files: string[] }
  | { type: 'SET_TASK_INPUT'; value: string }
  | { type: 'LOAD_TASKS'; tasks: Task[] }
