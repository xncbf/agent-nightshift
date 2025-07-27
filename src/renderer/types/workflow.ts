export interface LoopConfig {
  id: string
  startTaskId: string
  endTaskId: string
  condition: 'until-success' | 'max-attempts' | 'time-limit'
  maxAttempts?: number
  timeLimit?: number // in minutes
  currentAttempt?: number
  onFailure: 'continue' | 'stop'
}

export interface TaskNode {
  id: string
  type: 'task' | 'start' | 'end' | 'decision' | 'loop-start' | 'loop-end'
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  duration?: number
  dependencies: string[]
  position: { x: number; y: number }
  loopId?: string // Reference to loop this task belongs to
}

export interface TaskEdge {
  id: string
  source: string
  target: string
  type?: 'default' | 'conditional'
  condition?: string
}

export interface WorkflowPlan {
  id: string
  name: string
  description: string
  nodes: TaskNode[]
  edges: TaskEdge[]
  loops?: LoopConfig[]
  status: 'draft' | 'running' | 'completed' | 'failed'
  createdAt: Date
  estimatedDuration: number
}