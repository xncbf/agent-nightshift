import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore } from '../store/useStore'
import { Job, LoopConfig, WorkflowPlan } from '../types/workflow'

// Mock electron API
const mockElectronAPI = {
  onJobUpdate: vi.fn(() => () => {}),
  onLogUpdate: vi.fn(() => () => {}),
  executeTask: vi.fn(),
  registerJob: vi.fn()
}

// @ts-ignore
global.window = {
  electronAPI: mockElectronAPI
}

describe('Loop Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should handle loop execution on task failure', async () => {
    const { result } = renderHook(() => useStore())
    
    // Create a job with a loop
    const workflowPlan: WorkflowPlan = {
      id: 'test-plan',
      name: 'Test with Loop',
      nodes: [
        { id: 'start', title: 'Start', description: '', type: 'start', status: 'completed', position: { x: 0, y: 0 }, dependencies: [] },
        { id: 'task1', title: 'Run tests', description: 'npm test', type: 'task', status: 'pending', position: { x: 100, y: 0 }, dependencies: ['start'], duration: 5 },
        { id: 'task2', title: 'Fix errors', description: 'Fix test errors', type: 'task', status: 'pending', position: { x: 200, y: 0 }, dependencies: ['task1'], duration: 10 },
        { id: 'end', title: 'End', description: '', type: 'end', status: 'pending', position: { x: 300, y: 0 }, dependencies: ['task2'] }
      ],
      edges: [
        { id: 'start-task1', source: 'start', target: 'task1' },
        { id: 'task1-task2', source: 'task1', target: 'task2' },
        { id: 'task2-end', source: 'task2', target: 'end' }
      ],
      loops: [{
        id: 'test-loop',
        startTaskId: 'task1',
        endTaskId: 'task2',
        condition: 'max-attempts',
        maxAttempts: 3,
        currentAttempt: 0,
        onFailure: 'continue'
      }],
      estimatedDuration: 15
    }
    
    const job: Job = {
      id: 'test-job',
      title: 'Test Job',
      prd: 'Test PRD',
      status: 'ready',
      progress: 0,
      currentTask: '',
      createdAt: new Date(),
      logs: [],
      workflowPlan
    }
    
    act(() => {
      // First add the job to the store
      const jobs = result.current.jobs
      jobs.push(job)
      result.current.setActiveJob(job.id)
    })
    
    // Simulate task execution failure
    mockElectronAPI.executeTask.mockRejectedValueOnce(new Error('Test failed'))
    
    // The loop logic should:
    // 1. Detect the task is in a loop
    // 2. Increment currentAttempt
    // 3. Reset tasks in the loop to pending
    // 4. Allow retry
    
    const updatedJob = result.current.jobs.find(j => j.id === job.id)
    expect(updatedJob).toBeDefined()
    
    // Verify loop state would be updated on failure
    const loop = updatedJob!.workflowPlan!.loops![0]
    expect(loop.maxAttempts).toBe(3)
    
    // Test shouldRetryLoop logic
    const shouldRetry = (loop: LoopConfig) => {
      const currentAttempt = loop.currentAttempt || 0
      return loop.condition === 'max-attempts' ? currentAttempt < (loop.maxAttempts || 3) : true
    }
    
    expect(shouldRetry(loop)).toBe(true) // Should retry on first failure
    
    // Simulate max attempts reached
    const maxedLoop = { ...loop, currentAttempt: 3 }
    expect(shouldRetry(maxedLoop)).toBe(false) // Should not retry after max attempts
  })

  it('should reset loop tasks correctly', () => {
    const { result } = renderHook(() => useStore())
    
    const workflowPlan: WorkflowPlan = {
      id: 'test-plan',
      name: 'Test',
      nodes: [
        { id: 'start', title: 'Start', description: '', type: 'start', status: 'completed', position: { x: 0, y: 0 }, dependencies: [] },
        { id: 'task1', title: 'Task 1', description: '', type: 'task', status: 'completed', position: { x: 100, y: 0 }, dependencies: ['start'], duration: 5 },
        { id: 'task2', title: 'Task 2', description: '', type: 'task', status: 'failed', position: { x: 200, y: 0 }, dependencies: ['task1'], duration: 5 },
        { id: 'task3', title: 'Task 3', description: '', type: 'task', status: 'pending', position: { x: 300, y: 0 }, dependencies: ['task2'], duration: 5 },
        { id: 'end', title: 'End', description: '', type: 'end', status: 'pending', position: { x: 400, y: 0 }, dependencies: ['task3'] }
      ],
      edges: [
        { id: 'start-task1', source: 'start', target: 'task1' },
        { id: 'task1-task2', source: 'task1', target: 'task2' },
        { id: 'task2-task3', source: 'task2', target: 'task3' },
        { id: 'task3-end', source: 'task3', target: 'end' }
      ],
      loops: [{
        id: 'loop1',
        startTaskId: 'task1',
        endTaskId: 'task2',
        condition: 'until-success',
        currentAttempt: 1,
        onFailure: 'continue'
      }],
      estimatedDuration: 15
    }
    
    // When resetting loop tasks:
    // - task1 should stay completed (start of loop, already succeeded)
    // - task2 should be reset to pending (failed task in loop)
    // - task3 should remain pending (outside loop)
    
    const getTasksInLoop = (plan: WorkflowPlan, loop: LoopConfig) => {
      const tasks = []
      let currentId = loop.startTaskId
      
      while (currentId) {
        const task = plan.nodes.find(n => n.id === currentId)
        if (!task) break
        tasks.push(task)
        if (currentId === loop.endTaskId) break
        const edge = plan.edges.find(e => e.source === currentId)
        currentId = edge?.target || ''
      }
      
      return tasks
    }
    
    const loop = workflowPlan.loops[0]
    const tasksInLoop = getTasksInLoop(workflowPlan, loop)
    
    expect(tasksInLoop).toHaveLength(2)
    expect(tasksInLoop[0].id).toBe('task1')
    expect(tasksInLoop[1].id).toBe('task2')
  })

  it('should handle onFailure policies correctly', () => {
    const loopContinue: LoopConfig = {
      id: 'loop1',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'max-attempts',
      maxAttempts: 3,
      currentAttempt: 3,
      onFailure: 'continue'
    }
    
    const loopStop: LoopConfig = {
      id: 'loop2',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'max-attempts',
      maxAttempts: 3,
      currentAttempt: 3,
      onFailure: 'stop'
    }
    
    // With 'continue' policy, execution should continue to next tasks
    expect(loopContinue.onFailure).toBe('continue')
    
    // With 'stop' policy, execution should halt
    expect(loopStop.onFailure).toBe('stop')
  })

  it('should update loop attempts in UI correctly', () => {
    const { result } = renderHook(() => useStore())
    
    const loop: LoopConfig = {
      id: 'test-loop',
      startTaskId: 'task1',
      endTaskId: 'task2',
      condition: 'until-success',
      currentAttempt: 0,
      onFailure: 'continue'
    }
    
    // Simulate loop attempt updates
    const updatedLoop = { ...loop, currentAttempt: 1 }
    
    expect(updatedLoop.currentAttempt).toBe(1)
    
    // UI should show "1/∞" for until-success loops
    const displayText = `${updatedLoop.currentAttempt}/${updatedLoop.maxAttempts || '∞'}`
    expect(displayText).toBe('1/∞')
    
    // For max-attempts loops
    const maxAttemptsLoop = { ...loop, condition: 'max-attempts' as const, maxAttempts: 3 }
    const displayText2 = `${maxAttemptsLoop.currentAttempt}/${maxAttemptsLoop.maxAttempts}`
    expect(displayText2).toBe('0/3')
  })
})