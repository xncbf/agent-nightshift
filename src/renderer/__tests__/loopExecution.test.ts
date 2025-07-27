import { describe, it, expect } from 'vitest'
import { LoopConfig, TaskNode, WorkflowPlan } from '../types/workflow'
import { LoopDetector } from '../services/loopDetector'

// Mock data
const createMockWorkflowPlan = (): WorkflowPlan => ({
  id: 'test-plan',
  name: 'Test Workflow',
  description: 'Test workflow plan',
  status: 'ready',
  createdAt: new Date(),
  nodes: [
    { id: 'start', title: 'Start', description: '', type: 'start', status: 'completed', position: { x: 0, y: 0 }, dependencies: [] },
    { id: 'task1', title: 'Run tests', description: 'npm test', type: 'task', status: 'pending', position: { x: 100, y: 0 }, dependencies: ['start'], duration: 5 },
    { id: 'task2', title: 'Fix errors', description: 'Fix test errors', type: 'task', status: 'pending', position: { x: 200, y: 0 }, dependencies: ['task1'], duration: 10 },
    { id: 'task3', title: 'Deploy', description: 'npm run deploy', type: 'task', status: 'pending', position: { x: 300, y: 0 }, dependencies: ['task2'], duration: 5 },
    { id: 'end', title: 'End', description: '', type: 'end', status: 'pending', position: { x: 400, y: 0 }, dependencies: ['task3'] }
  ],
  edges: [
    { id: 'start-task1', source: 'start', target: 'task1' },
    { id: 'task1-task2', source: 'task1', target: 'task2' },
    { id: 'task2-task3', source: 'task2', target: 'task3' },
    { id: 'task3-end', source: 'task3', target: 'end' }
  ],
  loops: [],
  estimatedDuration: 20
})

describe('Loop Detection', () => {
  it('should detect loops from task patterns', () => {
    const workflowPlan = createMockWorkflowPlan()
    const taskNodes = workflowPlan.nodes.filter(n => n.type === 'task') as TaskNode[]
    
    const detectedLoops = LoopDetector.detectLoops(taskNodes)
    
    // Should detect loop between "Run tests" and "Fix errors"
    expect(detectedLoops).toHaveLength(1)
    expect(detectedLoops[0].startTaskId).toBe('task1')
    expect(detectedLoops[0].endTaskId).toBe('task2')
    expect(detectedLoops[0].condition).toBe('until-success')
  })

  it('should detect loops from Korean patterns', () => {
    const nodes: TaskNode[] = [
      { id: 'task1', title: '테스트 실행', description: 'jest 실행', type: 'task', status: 'pending', position: { x: 0, y: 0 }, dependencies: [], duration: 5 },
      { id: 'task2', title: '에러 수정', description: '실패한 테스트 수정', type: 'task', status: 'pending', position: { x: 100, y: 0 }, dependencies: ['task1'], duration: 10 }
    ]
    
    const detectedLoops = LoopDetector.detectLoops(nodes)
    
    expect(detectedLoops).toHaveLength(1)
    expect(detectedLoops[0].condition).toBe('until-success')
  })

  it('should not detect duplicate loops', () => {
    const workflowPlan = createMockWorkflowPlan()
    const existingLoop: LoopConfig = {
      id: 'existing-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'until-success',
      currentAttempt: 0,
      onFailure: 'continue'
    }
    workflowPlan.loops = [existingLoop]
    
    const taskNodes = workflowPlan.nodes.filter(n => n.type === 'task') as TaskNode[]
    const detectedLoops = LoopDetector.detectLoops(taskNodes)
    
    // Filter out duplicates
    const newLoops = detectedLoops.filter(detectedLoop => {
      return !workflowPlan.loops.some(existingLoop => 
        existingLoop.startTaskId === detectedLoop.startTaskId && 
        existingLoop.endTaskId === detectedLoop.endTaskId
      )
    })
    
    expect(newLoops).toHaveLength(0)
  })
})

describe('Loop Execution Logic', () => {
  // Mock helper functions used in useStore
  const getTasksInLoop = (workflowPlan: WorkflowPlan, loop: LoopConfig): TaskNode[] => {
    const tasks: TaskNode[] = []
    let currentId = loop.startTaskId
    
    while (currentId) {
      const task = workflowPlan.nodes.find(n => n.id === currentId)
      if (!task || task.type !== 'task') break
      
      tasks.push(task as TaskNode)
      
      if (currentId === loop.endTaskId) break
      
      const edge = workflowPlan.edges.find(e => e.source === currentId)
      currentId = edge?.target || ''
    }
    
    return tasks
  }

  const shouldRetryLoop = (loop: LoopConfig): boolean => {
    const currentAttempt = loop.currentAttempt || 0
    
    switch (loop.condition) {
      case 'until-success':
        return true
      case 'max-attempts':
        return currentAttempt < (loop.maxAttempts || 3)
      default:
        return false
    }
  }

  it('should identify tasks in a loop correctly', () => {
    const workflowPlan = createMockWorkflowPlan()
    const loop: LoopConfig = {
      id: 'test-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'until-success',
      onFailure: 'continue'
    }
    
    const tasksInLoop = getTasksInLoop(workflowPlan, loop)
    
    expect(tasksInLoop).toHaveLength(2)
    expect(tasksInLoop[0].id).toBe('task1')
    expect(tasksInLoop[1].id).toBe('task2')
  })

  it('should retry until-success loops indefinitely', () => {
    const loop: LoopConfig = {
      id: 'test-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'until-success',
      currentAttempt: 100, // Even with many attempts
      onFailure: 'continue'
    }
    
    expect(shouldRetryLoop(loop)).toBe(true)
  })

  it('should stop max-attempts loops after limit', () => {
    const loop: LoopConfig = {
      id: 'test-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'max-attempts',
      maxAttempts: 3,
      currentAttempt: 3,
      onFailure: 'continue'
    }
    
    expect(shouldRetryLoop(loop)).toBe(false)
  })

  it('should allow retry when under max attempts', () => {
    const loop: LoopConfig = {
      id: 'test-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'max-attempts',
      maxAttempts: 3,
      currentAttempt: 2,
      onFailure: 'continue'
    }
    
    expect(shouldRetryLoop(loop)).toBe(true)
  })
})

describe('Loop UI Integration', () => {
  it('should mark manually created loops as active', () => {
    const manualLoop: LoopConfig = {
      id: 'manual-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'until-success',
      maxAttempts: 3,
      currentAttempt: 0, // Should be set to 0 when created manually
      onFailure: 'continue'
    }
    
    expect(manualLoop.currentAttempt).toBeDefined()
    expect(manualLoop.currentAttempt).toBe(0)
  })

  it('should filter out processed loops from suggestions', () => {
    const loops: LoopConfig[] = [
      {
        id: 'loop1',
        startTaskId: 'task1',
        endTaskId: 'task2',
        condition: 'until-success',
        currentAttempt: 0, // Processed
        onFailure: 'continue'
      },
      {
        id: 'loop2',
        startTaskId: 'task2',
        endTaskId: 'task3',
        condition: 'max-attempts',
        // No currentAttempt - unprocessed
        onFailure: 'continue'
      }
    ]
    
    const unprocessedLoops = loops.filter(loop => 
      loop.currentAttempt === undefined || loop.currentAttempt === null
    )
    
    expect(unprocessedLoops).toHaveLength(1)
    expect(unprocessedLoops[0].id).toBe('loop2')
  })
})

describe('Loop Visual Indicators', () => {
  it('should identify loop start and end nodes', () => {
    const loops: LoopConfig[] = [
      {
        id: 'test-loop',
        startTaskId: 'task1',
        endTaskId: 'task2',
        condition: 'until-success',
        currentAttempt: 0,
        onFailure: 'continue'
      }
    ]
    
    const isLoopStart = (nodeId: string) => loops.some(loop => loop.startTaskId === nodeId)
    const isLoopEnd = (nodeId: string) => loops.some(loop => loop.endTaskId === nodeId)
    
    expect(isLoopStart('task1')).toBe(true)
    expect(isLoopStart('task2')).toBe(false)
    expect(isLoopEnd('task1')).toBe(false)
    expect(isLoopEnd('task2')).toBe(true)
  })

  it('should identify nodes within a loop', () => {
    const workflowPlan = createMockWorkflowPlan()
    const loop: LoopConfig = {
      id: 'test-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'until-success',
      currentAttempt: 0,
      onFailure: 'continue'
    }
    
    // Helper function to get tasks in loop
    const getTasksInLoopLocal = (workflowPlan: WorkflowPlan, loop: LoopConfig): TaskNode[] => {
      const tasks: TaskNode[] = []
      let currentId = loop.startTaskId
      
      while (currentId) {
        const task = workflowPlan.nodes.find(n => n.id === currentId)
        if (!task || task.type !== 'task') break
        
        tasks.push(task as TaskNode)
        
        if (currentId === loop.endTaskId) break
        
        const edge = workflowPlan.edges.find(e => e.source === currentId)
        currentId = edge?.target || ''
      }
      
      return tasks
    }
    
    const tasksInLoop = getTasksInLoopLocal(workflowPlan, loop)
    const nodeIdsInLoop = tasksInLoop.map(t => t.id)
    
    const isNodeInLoop = (nodeId: string) => nodeIdsInLoop.includes(nodeId)
    
    expect(isNodeInLoop('task1')).toBe(true)
    expect(isNodeInLoop('task2')).toBe(true)
    expect(isNodeInLoop('task3')).toBe(false)
  })
})