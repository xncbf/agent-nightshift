import { create } from 'zustand'
import { WorkflowPlan } from '../types/workflow'

interface Job {
  id: string
  prd: string
  status: 'pending' | 'planning' | 'ready' | 'running' | 'paused' | 'completed' | 'failed'
  progress: number
  currentTask: string
  logs: string[]
  createdAt: Date
  workflowPlan?: WorkflowPlan
}


interface AppState {
  // PRD Editor
  currentPRD: string
  setCurrentPRD: (prd: string) => void
  
  // Jobs
  jobs: Job[]
  activeJobId: string | null
  addJob: (prd: string) => Promise<string>
  updateJob: (id: string, updates: Partial<Job>) => void
  setActiveJob: (id: string | null) => void
  approveWorkflowPlan: (jobId: string) => void
  rejectWorkflowPlan: (jobId: string) => void
  pauseJob: (jobId: string) => void
  resumeJob: (jobId: string) => void
  stopJob: (jobId: string) => void
  cancelPlanGeneration: (jobId: string) => void
  createManualPlan: (prd: string) => Promise<string>
  
  // UI State
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
  layoutMode: 'editing' | 'planning' | 'executing'
  setLayoutMode: (mode: 'editing' | 'planning' | 'executing') => void
  focusedPanel: 'prd' | 'workflow' | 'output' | null
  setFocusedPanel: (panel: 'prd' | 'workflow' | 'output' | null) => void
  
  // Work Directory Configuration
  workDirectory: string
  setWorkDirectory: (path: string) => void
  
  // AI Configuration
  aiProvider: 'openai' | 'claude'
  setAiProvider: (provider: 'openai' | 'claude') => void
  openaiModel: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo'
  setOpenaiModel: (model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') => void
  openaiApiKey: string
  setOpenaiApiKey: (key: string) => void
  isOpenaiConfigured: boolean
  claudeModel: 'claude-sonnet-4-0' | 'claude-opus-4-0'
  setClaudeModel: (model: 'claude-sonnet-4-0' | 'claude-opus-4-0') => void
  claudeApiKey: string
  setClaudeApiKey: (key: string) => void
  isClaudeConfigured: boolean
  isAIConfigured: boolean
}

// Workflow execution function
async function executeWorkflowTasks(jobId: string, job: Job) {
  const { workflowPlan } = job
  if (!workflowPlan) return

  const { updateJob, workDirectory, aiProvider, openaiModel, claudeModel } = useStore.getState()
  
  // Get task nodes and sort by dependencies
  const taskNodes = workflowPlan.nodes.filter((n: any) => n.type === 'task')
  
  // Update all tasks to pending except start
  const resetNodes = workflowPlan.nodes.map((node: any) => ({
    ...node,
    status: node.type === 'start' ? 'completed' : 'pending'
  }))
  
  updateJob(jobId, {
    workflowPlan: { ...workflowPlan, nodes: resetNodes }
  })

  // Execute tasks in dependency order
  const completedTasks = new Set(['start'])
  const runningTasks = new Set()

  while (completedTasks.size - 1 < taskNodes.length) { // -1 for start node
    // Find tasks that can run (all dependencies completed)
    const readyTasks = taskNodes.filter((task: any) => {
      const isReady = task.status === 'pending' && 
        task.dependencies.every((dep: string) => completedTasks.has(dep)) &&
        !runningTasks.has(task.id)
      
      // Debug log
      if (task.status === 'pending') {
        console.log(`Task ${task.id} check:`, {
          status: task.status,
          dependencies: task.dependencies,
          completedTasks: Array.from(completedTasks),
          depsCompleted: task.dependencies.every((dep: string) => completedTasks.has(dep)),
          isRunning: runningTasks.has(task.id),
          isReady
        })
      }
      
      return isReady
    })

    if (readyTasks.length === 0) {
      // Check if we have running tasks
      if (runningTasks.size > 0) {
        // Wait for running tasks to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      } else {
        // No ready tasks and no running tasks - workflow stuck
        break
      }
    }

    // Start ready tasks
    for (const task of readyTasks) {
      runningTasks.add(task.id)
      executeTask(jobId, task, workDirectory, aiProvider, openaiModel, claudeModel)
        .then(() => {
          runningTasks.delete(task.id)
          completedTasks.add(task.id)
          
          console.log(`Task ${task.id} completed. CompletedTasks:`, Array.from(completedTasks))
          
          // Update task status to completed
          const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
          if (currentJob?.workflowPlan) {
            const updatedNodes = currentJob.workflowPlan.nodes.map((n: any) =>
              n.id === task.id ? { ...n, status: 'completed' } : n
            )
            updateJob(jobId, {
              workflowPlan: { ...currentJob.workflowPlan, nodes: updatedNodes },
              progress: Math.round((completedTasks.size - 1) / taskNodes.length * 100)
            })
          }
        })
        .catch((error) => {
          runningTasks.delete(task.id)
          console.error(`Task ${task.id} failed:`, error)
          
          // Update task status to failed
          const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
          if (currentJob?.workflowPlan) {
            const updatedNodes = currentJob.workflowPlan.nodes.map((n: any) =>
              n.id === task.id ? { ...n, status: 'failed' } : n
            )
            updateJob(jobId, {
              workflowPlan: { ...currentJob.workflowPlan, nodes: updatedNodes },
              logs: [...(currentJob.logs || []), `❌ Task ${task.title} failed: ${error.message}`]
            })
          }
        })

      // Update task status to running
      const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
      if (currentJob?.workflowPlan) {
        const updatedNodes = currentJob.workflowPlan.nodes.map((n: any) =>
          n.id === task.id ? { ...n, status: 'running' } : n
        )
        updateJob(jobId, {
          workflowPlan: { ...currentJob.workflowPlan, nodes: updatedNodes },
          currentTask: `Executing: ${task.title}`
        })
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Check if all tasks completed successfully
  const finalJob = useStore.getState().jobs.find(j => j.id === jobId)
  if (finalJob?.workflowPlan) {
    const allTasksCompleted = taskNodes.every((task: any) => 
      finalJob.workflowPlan!.nodes.find((n: any) => n.id === task.id)?.status === 'completed'
    )
    
    updateJob(jobId, {
      status: allTasksCompleted ? 'completed' : 'failed',
      currentTask: allTasksCompleted ? 'All tasks completed!' : 'Some tasks failed',
      progress: 100
    })
  }
}

// Execute individual task
async function executeTask(
  jobId: string, 
  task: any, 
  workDirectory: string, 
  _aiProvider: string, // Keep for interface compatibility
  _openaiModel: string,
  _claudeModel: string
) {
  const { updateJob } = useStore.getState()
  
  // Create prompt for Claude Code CLI
  const prompt = `Task: ${task.title}

Description: ${task.description}

Working Directory: ${workDirectory}

Please complete this task step by step. You have access to all MCP tools for file operations, terminal commands, and any other capabilities you need. Work in the specified directory and complete the task fully.`

  try {
    // Create terminal for this task and initialize with Claude
    await initializeClaudeTerminal(task.id, workDirectory)

    // Log the task start
    const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (currentJob) {
      updateJob(jobId, {
        logs: [...(currentJob.logs || []), `🚀 Starting task: ${task.title}`]
      })
    }

    // Send prompt to waiting Claude instance
    await sendPromptToClaudeTerminal(prompt, task.id)

    // Log task completion (Note: in reality we'd monitor output to detect completion)
    const updatedJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (updatedJob) {
      updateJob(jobId, {
        logs: [...(updatedJob.logs || []), `✅ Task sent to Claude: ${task.title}`]
      })
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to execute task: ${errorMessage}`)
  }
}

// Initialize terminal with Claude Code CLI in interactive mode
async function initializeClaudeTerminal(terminalId: string, workDirectory: string) {
  try {
    // Create terminal for this task
    const terminalResult = await window.electronAPI.createTerminal(workDirectory, terminalId)
    if (!terminalResult.success) {
      throw new Error(`Failed to create terminal: ${terminalResult.error}`)
    }

    // Set up terminal output monitoring
    let terminalOutput = ''
    let isClaudeReady = false
    
    const outputHandler = (_event: any, data: { terminalId: string; data: string }) => {
      if (data.terminalId === terminalId) {
        terminalOutput += data.data
        
        // Check for Claude startup indicators
        if (terminalOutput.includes('Welcome to Claude Code!') || 
            terminalOutput.includes('claude>') ||
            terminalOutput.includes('cwd:')) {
          isClaudeReady = true
        }
      }
    }
    
    const unsubscribe = (window.electronAPI as any).onTerminalData(outputHandler)

    // Change to working directory
    await (window.electronAPI as any).sendTerminalInput(`cd "${workDirectory}"\n`, terminalId)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Check if Claude is already running by looking at current output
    if (terminalOutput.includes('Welcome to Claude Code!') || terminalOutput.includes('cwd:')) {
      console.log(`Claude Code already running in terminal ${terminalId}`)
      isClaudeReady = true
    } else {
      // Start Claude Code CLI in interactive mode
      await (window.electronAPI as any).sendTerminalInput('claude\n', terminalId)
    }
    
    // Wait for Claude to be ready (with timeout)
    const startTime = Date.now()
    const timeout = 10000 // 10 seconds timeout
    
    while (!isClaudeReady && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // Clean up listener
    unsubscribe()
    
    if (!isClaudeReady) {
      throw new Error(`Claude Code CLI did not start within ${timeout/1000} seconds. Output: ${terminalOutput}`)
    }
    
    console.log(`✅ Claude Code ready in terminal ${terminalId}`)
    
  } catch (error) {
    console.error('Failed to initialize Claude terminal:', error)
    throw error
  }
}

// Send prompt to Claude that's already running in terminal
async function sendPromptToClaudeTerminal(prompt: string, terminalId: string) {
  try {
    // Set up output monitoring to detect when Claude finishes
    let terminalOutput = ''
    let isTaskComplete = false
    
    const outputHandler = (_event: any, data: { terminalId: string; data: string }) => {
      if (data.terminalId === terminalId) {
        terminalOutput += data.data
        
        // Check for task completion indicators
        if (isClaudeCommandComplete(terminalOutput)) {
          isTaskComplete = true
        }
      }
    }
    
    const unsubscribe = (window.electronAPI as any).onTerminalData(outputHandler)
    
    // Send the entire prompt as one input to Claude
    await (window.electronAPI as any).sendTerminalInput(prompt, terminalId)
    
    // Send Enter to execute the prompt
    await (window.electronAPI as any).sendTerminalInput('\n', terminalId)
    
    // Wait for task completion (with timeout)
    const startTime = Date.now()
    const timeout = 300000 // 5 minutes timeout for task execution
    
    while (!isTaskComplete && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Clean up listener
    unsubscribe()
    
    if (!isTaskComplete) {
      console.warn(`Task did not complete within ${timeout/1000} seconds in terminal ${terminalId}`)
      // Don't throw error, let it continue - user can monitor in terminal
    } else {
      console.log(`✅ Task completed in terminal ${terminalId}`)
    }
    
  } catch (error) {
    console.error('Failed to send prompt to Claude terminal:', error)
    throw error
  }
}

// Helper function to detect Claude Code CLI completion
export function isClaudeCommandComplete(terminalOutput: string): boolean {
  // Check for Claude Code completion patterns
  const lines = terminalOutput.split('\n')
  const lastFewLines = lines.slice(-10).join('\n') // Check last 10 lines
  
  // Look for Claude's completion indicators
  const completionIndicators = [
    '🎉',
    '✅',
    'Task completed',
    'task completed',
    'Successfully completed',
    'successfully completed',
    'Done!',
    'done!',
    'Finished',
    'finished',
    'All set!',
    'all set!'
  ]
  
  const hasCompletionIndicator = completionIndicators.some(indicator => 
    lastFewLines.toLowerCase().includes(indicator.toLowerCase())
  )
  
  // Also check if we're back at a shell prompt (but not immediately after starting)
  const hasShellPrompt = lastFewLines.includes('$ ') || 
                        lastFewLines.includes('% ') ||
                        lastFewLines.includes('❯ ')
  
  // Look for error indicators
  const hasError = lastFewLines.includes('Error:') || 
                  lastFewLines.includes('error:') ||
                  lastFewLines.includes('Failed:') ||
                  lastFewLines.includes('failed:')
  
  return (hasCompletionIndicator || hasShellPrompt) && !hasError
}

export const useStore = create<AppState>((set, get) => {
  // Load saved preferences from localStorage
  const savedOpenaiApiKey = localStorage.getItem('openai_api_key') || ''
  const savedClaudeApiKey = localStorage.getItem('claude_api_key') || ''
  const savedProvider = (localStorage.getItem('ai_provider') as 'openai' | 'claude') || 'openai'
  const savedOpenaiModel = (localStorage.getItem('openai_model') as 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') || 'gpt-4o-mini'
  const savedClaudeModel = (localStorage.getItem('claude_model') as 'claude-sonnet-4-0' | 'claude-opus-4-0') || 'claude-sonnet-4-0'
  const savedWorkDirectory = localStorage.getItem('work_directory') || '/Users/joon/projects'
  
  // Load saved PRD and jobs
  const savedPRD = localStorage.getItem('current_prd') || ''
  
  let savedJobs = []
  try {
    savedJobs = JSON.parse(localStorage.getItem('jobs') || '[]').map((job: any) => ({
      ...job,
      createdAt: new Date(job.createdAt),
      // Ensure required properties exist
      logs: job.logs || [],
      status: job.status || 'pending',
      progress: job.progress || 0,
      currentTask: job.currentTask || ''
    }))
  } catch (error) {
    console.warn('Failed to load saved jobs from localStorage:', error)
    savedJobs = []
  }
  
  const savedActiveJobId = localStorage.getItem('active_job_id') || null
  
  // Validate active job ID exists in saved jobs
  const validActiveJobId = savedJobs.find(job => job.id === savedActiveJobId) ? savedActiveJobId : null
  
  return {
  // PRD Editor
  currentPRD: savedPRD,
  setCurrentPRD: (prd) => {
    set({ currentPRD: prd })
    localStorage.setItem('current_prd', prd)
  },
  
  // Jobs
  jobs: savedJobs,
  activeJobId: validActiveJobId,
  
  addJob: async (prd) => {
    const { submitPRD } = window.electronAPI
    
    set({ isSubmitting: true })
    
    // Check if there's an existing planning job and cancel it
    const currentState = get()
    const planningJob = currentState.jobs.find(job => job.status === 'planning')
    if (planningJob) {
      // Cancel the existing planning job
      set(state => {
        const updatedJobs = state.jobs.map(job => 
          job.status === 'planning' 
            ? { 
                ...job, 
                status: 'failed' as const,
                currentTask: 'Cancelled by user - new plan requested',
                logs: [...job.logs, '⏹️ Planning cancelled - new plan requested']
              } 
            : job
        )
        localStorage.setItem('jobs', JSON.stringify(updatedJobs))
        return { jobs: updatedJobs }
      })
    }
    
    try {
      const result = await submitPRD(prd)
      
      if (result.success) {
        const newJob: Job = {
          id: result.jobId,
          prd,
          status: 'planning',
          progress: 0,
          currentTask: 'Analyzing PRD and creating workflow plan...',
          logs: ['Job started', '> Analyzing PRD with Claude Code...'],
          createdAt: new Date()
        }
        
        set(state => {
          const updatedJobs = [...state.jobs, newJob]
          const newState = {
            jobs: updatedJobs,
            activeJobId: result.jobId,
            isSubmitting: false,
            layoutMode: 'planning' as const,
            focusedPanel: 'workflow' as const
          }
          
          // Save to localStorage
          localStorage.setItem('jobs', JSON.stringify(updatedJobs))
          localStorage.setItem('active_job_id', result.jobId)
          
          return newState
        })
        
        // Generate workflow plan with WorkflowAI
        setTimeout(async () => {
          const { WorkflowAI } = await import('../services/workflowAI')
          
          // Create a log function that updates the job's logs
          const addLogToJob = (log: string) => {
            set(state => {
              const updatedJobs = state.jobs.map(job => 
                job.id === result.jobId 
                  ? { ...job, logs: [...job.logs, log] } 
                  : job
              )
              localStorage.setItem('jobs', JSON.stringify(updatedJobs))
              return { jobs: updatedJobs }
            })
          }
          
          // Get current AI provider settings
          const currentState = get()
          const workflowAI = new WorkflowAI(
            addLogToJob, 
            currentState.aiProvider, 
            currentState.openaiModel,
            currentState.claudeModel
          )
          
          try {
            // AI will automatically detect if it's single or multiple prompts
            const workflowPlan = await workflowAI.analyzeContentAndGenerateWorkflow(prd)
            
            set(state => {
              const updatedJobs = state.jobs.map(job => 
                job.id === result.jobId 
                  ? { 
                      ...job, 
                      workflowPlan,
                      status: 'ready' as const,
                      currentTask: 'Workflow plan ready for review. Please approve to start execution.',
                      logs: [...job.logs, '⏳ Waiting for approval...']
                    } 
                  : job
              )
              localStorage.setItem('jobs', JSON.stringify(updatedJobs))
              return { jobs: updatedJobs }
            })
          } catch (error) {
            console.error('Failed to generate workflow plan:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            set(state => {
              const updatedJobs = state.jobs.map(job => 
                job.id === result.jobId 
                  ? { 
                      ...job, 
                      status: 'failed' as const,
                      currentTask: 'Failed to generate workflow plan',
                      logs: [...job.logs, `❌ Failed to generate workflow plan: ${errorMessage}`]
                    } 
                  : job
              )
              localStorage.setItem('jobs', JSON.stringify(updatedJobs))
              return { jobs: updatedJobs }
            })
          }
        }, 1000)
        
        return result.jobId
      }
    } catch (error) {
      console.error('Failed to submit PRD:', error)
    }
    
    set({ isSubmitting: false })
    return ''
  },
  
  updateJob: (id, updates) => {
    const newState = get()
    const updatedJobs = newState.jobs.map(job => 
      job.id === id ? { ...job, ...updates } : job
    )
    set({ jobs: updatedJobs })
    localStorage.setItem('jobs', JSON.stringify(updatedJobs))
  },
  
  setActiveJob: (id) => {
    set({ activeJobId: id })
    if (id) {
      localStorage.setItem('active_job_id', id)
    } else {
      localStorage.removeItem('active_job_id')
    }
  },
  
  approveWorkflowPlan: async (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'ready') {
      set(state => {
        const updatedJobs = state.jobs.map(j => 
          j.id === jobId 
            ? { 
                ...j, 
                status: 'running' as const,
                currentTask: 'Starting execution...',
                logs: [...j.logs, '✓ Workflow approved', '> Starting execution...']
              }
            : j
        )
        localStorage.setItem('jobs', JSON.stringify(updatedJobs))
        return {
          jobs: updatedJobs,
          layoutMode: 'executing',
          focusedPanel: 'output'
        }
      })

      // Execute the workflow tasks
      try {
        console.log('Starting workflow execution for job:', jobId)
        await executeWorkflowTasks(jobId, job)
      } catch (error) {
        console.error('Failed to start workflow execution:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        set(state => {
          const updatedJobs = state.jobs.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'failed' as const,
                  currentTask: 'Failed to start execution',
                  logs: [...j.logs, `❌ Execution failed: ${errorMessage}`]
                }
              : j
          )
          localStorage.setItem('jobs', JSON.stringify(updatedJobs))
          return { jobs: updatedJobs }
        })
      }
    }
  },
  
  rejectWorkflowPlan: (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'ready') {
      set(state => {
        const updatedJobs = state.jobs.map(j => 
          j.id === jobId 
            ? { 
                ...j, 
                status: 'failed' as const,
                currentTask: 'Workflow plan rejected',
                logs: [...j.logs, '✗ Workflow rejected by user']
              }
            : j
        )
        localStorage.setItem('jobs', JSON.stringify(updatedJobs))
        return {
          jobs: updatedJobs,
          layoutMode: 'editing' as const
        }
      })
    }
  },

  pauseJob: async (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'running') {
      try {
        if ((window.electronAPI as any).pauseJob) {
          const result = await (window.electronAPI as any).pauseJob(jobId)
          if (result.success) {
            set(state => ({
              jobs: state.jobs.map(j => 
                j.id === jobId 
                  ? { 
                      ...j, 
                      status: 'paused' as const,
                      currentTask: 'Execution paused by user',
                      logs: [...j.logs, '⏸️ Execution paused']
                    }
                  : j
              )
            }))
          }
        } else {
          // Fallback - just update the status
          set(state => ({
            jobs: state.jobs.map(j => 
              j.id === jobId 
                ? { 
                    ...j, 
                    status: 'paused' as const,
                    currentTask: 'Execution paused by user',
                    logs: [...j.logs, '⏸️ Execution paused']
                  }
                : j
            )
          }))
        }
      } catch (error) {
        console.error('Failed to pause job:', error)
      }
    }
  },

  resumeJob: async (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'paused') {
      try {
        if ((window.electronAPI as any).resumeJob) {
          const result = await (window.electronAPI as any).resumeJob(jobId)
          if (result.success) {
            set(state => ({
              jobs: state.jobs.map(j => 
                j.id === jobId 
                  ? { 
                      ...j, 
                      status: 'running' as const,
                      currentTask: 'Resuming execution...',
                      logs: [...j.logs, '▶️ Execution resumed']
                    }
                  : j
              )
            }))
          }
        } else {
          // Fallback - just update the status
          set(state => ({
            jobs: state.jobs.map(j => 
              j.id === jobId 
                ? { 
                    ...j, 
                    status: 'running' as const,
                    currentTask: 'Resuming execution...',
                    logs: [...j.logs, '▶️ Execution resumed']
                  }
                : j
            )
          }))
        }
      } catch (error) {
        console.error('Failed to resume job:', error)
      }
    }
  },

  stopJob: async (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && (job.status === 'running' || job.status === 'paused')) {
      try {
        if ((window.electronAPI as any).stopJob) {
          const result = await (window.electronAPI as any).stopJob(jobId)
          if (result.success) {
            set(state => {
              const updatedJobs = state.jobs.map(j => {
                if (j.id === jobId) {
                  // Reset workflow nodes to pending state
                  const resetWorkflowPlan = j.workflowPlan ? {
                    ...j.workflowPlan,
                    nodes: j.workflowPlan.nodes.map(node => ({
                      ...node,
                      status: node.type === 'start' ? 'completed' as const : 'pending' as const
                    }))
                  } : j.workflowPlan

                  return {
                    ...j,
                    status: 'ready' as const,
                    progress: 0,
                    currentTask: 'Workflow ready for execution',
                    logs: [...j.logs, '⏹️ Execution stopped - Ready to restart'],
                    workflowPlan: resetWorkflowPlan
                  }
                }
                return j
              })
              
              localStorage.setItem('jobs', JSON.stringify(updatedJobs))
              return {
                jobs: updatedJobs,
                layoutMode: 'planning' as const
              }
            })
          }
        } else {
          // Fallback - just update the status
          set(state => {
            const updatedJobs = state.jobs.map(j => {
              if (j.id === jobId) {
                // Reset workflow nodes to pending state
                const resetWorkflowPlan = j.workflowPlan ? {
                  ...j.workflowPlan,
                  nodes: j.workflowPlan.nodes.map(node => ({
                    ...node,
                    status: node.type === 'start' ? 'completed' as const : 'pending' as const
                  }))
                } : j.workflowPlan

                return {
                  ...j,
                  status: 'ready' as const,
                  progress: 0,
                  currentTask: 'Workflow ready for execution',
                  logs: [...j.logs, '⏹️ Execution stopped - Ready to restart'],
                  workflowPlan: resetWorkflowPlan
                }
              }
              return j
            })
            
            localStorage.setItem('jobs', JSON.stringify(updatedJobs))
            return {
              jobs: updatedJobs,
              layoutMode: 'planning' as const
            }
          })
        }
      } catch (error) {
        console.error('Failed to stop job:', error)
      }
    }
  },

  cancelPlanGeneration: (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'planning') {
      set(state => {
        const updatedJobs = state.jobs.map(j => 
          j.id === jobId 
            ? { 
                ...j, 
                status: 'failed' as const,
                currentTask: 'Plan generation cancelled by user',
                logs: [...j.logs, '⏹️ Plan generation cancelled']
              }
            : j
        )
        localStorage.setItem('jobs', JSON.stringify(updatedJobs))
        return { jobs: updatedJobs }
      })
    }
  },

  createManualPlan: async (prd) => {
    const jobId = `manual-${Date.now()}`
    
    // Create a basic manual workflow plan
    const nodes = [
      {
        id: 'start',
        title: 'Start',
        description: 'Workflow start',
        type: 'start' as const,
        status: 'completed' as const,
        position: { x: 100, y: 100 },
        dependencies: []
      },
      {
        id: 'task1',
        title: 'Task 1',
        description: 'First task - click to edit',
        type: 'task' as const,
        status: 'pending' as const,
        position: { x: 100, y: 250 },
        duration: 10,
        dependencies: ['start']
      },
      {
        id: 'end',
        title: 'Complete',
        description: 'All tasks completed',
        type: 'end' as const,
        status: 'pending' as const,
        position: { x: 100, y: 400 },
        dependencies: ['task1']
      }
    ]

    const edges = [
      { id: 'start-task1', source: 'start', target: 'task1' },
      { id: 'task1-end', source: 'task1', target: 'end' }
    ]

    const manualPlan = {
      id: `manual-workflow-${Date.now()}`,
      name: 'Manual Workflow',
      description: 'Manually created workflow plan',
      nodes,
      edges,
      status: 'draft' as const,
      createdAt: new Date(),
      estimatedDuration: 10
    }

    const newJob = {
      id: jobId,
      prd,
      status: 'ready' as const,
      progress: 0,
      currentTask: 'Manual workflow plan ready for review',
      logs: ['📝 Manual workflow plan created', '⏳ Ready for review and execution'],
      createdAt: new Date(),
      workflowPlan: manualPlan
    }

    set(state => {
      const updatedJobs = [...state.jobs, newJob]
      localStorage.setItem('jobs', JSON.stringify(updatedJobs))
      localStorage.setItem('active_job_id', jobId)
      
      return {
        jobs: updatedJobs,
        activeJobId: jobId,
        layoutMode: 'planning' as const,
        focusedPanel: 'workflow' as const
      }
    })

    return jobId
  },
  
  // UI State
  isSubmitting: false,
  setIsSubmitting: (value) => set({ isSubmitting: value }),
  layoutMode: 'editing',
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  focusedPanel: 'prd',
  setFocusedPanel: (panel) => set({ focusedPanel: panel }),
  
  // Work Directory Configuration
  workDirectory: savedWorkDirectory,
  setWorkDirectory: (path: string) => {
    set({ workDirectory: path })
    localStorage.setItem('work_directory', path)
  },
  
  // AI Configuration
  aiProvider: savedProvider,
  setAiProvider: (provider: 'openai' | 'claude') => {
    set({ aiProvider: provider })
    localStorage.setItem('ai_provider', provider)
    
    // Update isAIConfigured
    const state = get()
    set({ 
      isAIConfigured: (provider === 'openai' && !!state.openaiApiKey) ||
                     (provider === 'claude' && !!state.claudeApiKey)
    })
  },
  openaiModel: savedOpenaiModel,
  setOpenaiModel: (model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') => {
    set({ openaiModel: model })
    localStorage.setItem('openai_model', model)
  },
  
  // OpenAI API
  openaiApiKey: savedOpenaiApiKey,
  setOpenaiApiKey: (key) => {
    set({ openaiApiKey: key, isOpenaiConfigured: !!key })
    // Save to localStorage
    if (key) {
      localStorage.setItem('openai_api_key', key)
    } else {
      localStorage.removeItem('openai_api_key')
    }
    // Update isAIConfigured
    const state = get()
    set({ 
      isAIConfigured: (state.aiProvider === 'openai' && !!key) ||
                     (state.aiProvider === 'claude' && !!state.claudeApiKey)
    })
  },
  isOpenaiConfigured: !!savedOpenaiApiKey,
  
  // Claude API
  claudeModel: savedClaudeModel,
  setClaudeModel: (model: 'claude-sonnet-4-0' | 'claude-opus-4-0') => {
    set({ claudeModel: model })
    localStorage.setItem('claude_model', model)
  },
  claudeApiKey: savedClaudeApiKey,
  setClaudeApiKey: (key) => {
    set({ claudeApiKey: key, isClaudeConfigured: !!key })
    // Save to localStorage
    if (key) {
      localStorage.setItem('claude_api_key', key)
    } else {
      localStorage.removeItem('claude_api_key')
    }
    // Update isAIConfigured
    const state = get()
    set({ 
      isAIConfigured: (state.aiProvider === 'openai' && !!state.openaiApiKey) ||
                     (state.aiProvider === 'claude' && !!key)
    })
  },
  isClaudeConfigured: !!savedClaudeApiKey,
  
  // Computed state
  isAIConfigured: (savedProvider === 'openai' && !!savedOpenaiApiKey) ||
                 (savedProvider === 'claude' && !!savedClaudeApiKey)
  }
})
