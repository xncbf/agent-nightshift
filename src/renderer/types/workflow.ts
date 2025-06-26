export interface TaskNode {
  id: string
  type: 'task' | 'start' | 'end' | 'decision'
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  duration?: number
  dependencies: string[]
  position: { x: number; y: number }
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
  status: 'draft' | 'running' | 'completed' | 'failed'
  createdAt: Date
  estimatedDuration: number
}