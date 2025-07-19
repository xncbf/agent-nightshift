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

// Global execution controllers
const executionControllers = new Map<string, { shouldStop: boolean, shouldPause: boolean }>()

// Terminal functionality removed - using direct Claude execution

// Terminal functions removed - using direct Claude execution

// Safe task status updater to prevent workflow plan corruption
function updateTaskStatus(jobId: string, taskId: string, status: string, additionalUpdates?: { 
  currentTask?: string
  logs?: string[]
  progress?: number
}) {
  const { updateJob } = useStore.getState()
  const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
  
  if (!currentJob?.workflowPlan) {
    console.warn(`Cannot update task ${taskId}: job ${jobId} or workflow plan not found`)
    return
  }

  // Ensure we preserve ALL nodes in the workflow plan
  const updatedNodes = currentJob.workflowPlan.nodes.map((n: any) =>
    n.id === taskId ? { ...n, status } : { ...n }
  )
  
  const updatedWorkflowPlan = {
    ...currentJob.workflowPlan,
    nodes: updatedNodes
  }
  
  const updateData: any = {
    workflowPlan: updatedWorkflowPlan
  }
  
  if (additionalUpdates?.currentTask) {
    updateData.currentTask = additionalUpdates.currentTask
  }
  
  if (additionalUpdates?.logs) {
    updateData.logs = [...(currentJob.logs || []), ...additionalUpdates.logs]
  }
  
  if (additionalUpdates?.progress !== undefined) {
    updateData.progress = additionalUpdates.progress
  }
  
  updateJob(jobId, updateData)
  console.log(`📊 Updated task ${taskId} status to ${status}, workflow nodes: ${updatedWorkflowPlan.nodes.length}`)
  console.log(`📋 Workflow node types:`, updatedWorkflowPlan.nodes.map((n: any) => `${n.id}(${n.type})`).join(', '))
  
  // Debug: Track who's calling updateTaskStatus for completed tasks
  if (status === 'completed') {
    console.log(`🔍 Task ${taskId} marked as completed. Call stack:`)
    console.trace()
  }
}

// Workflow execution function
async function executeWorkflowTasks(jobId: string, job: Job) {
  console.log(`🎯 executeWorkflowTasks called for job ${jobId}`)
  const { workflowPlan } = job
  if (!workflowPlan) {
    console.error(`❌ No workflow plan found for job ${jobId}`)
    return
  }

  const { updateJob, workDirectory, aiProvider, openaiModel, claudeModel } = useStore.getState()
  console.log(`📂 Using work directory: ${workDirectory}`)
  
  // Initialize execution controller
  executionControllers.set(jobId, { shouldStop: false, shouldPause: false })
  
  // Register job with main process for pause/stop functionality
  try {
    await (window.electronAPI as any).registerJob({
      id: job.id,
      status: job.status,
      progress: job.progress,
      currentTask: job.currentTask,
      logs: job.logs,
      workflowPlan: job.workflowPlan
    })
    console.log('Job registered with main process:', jobId)
  } catch (error) {
    console.error('Failed to register job with main process:', error)
  }
  
  // Get initial task nodes and sort by dependencies
  const initialTaskNodes = workflowPlan.nodes.filter((n: any) => n.type === 'task')
  
  // Update all tasks to pending except start
  const resetNodes = workflowPlan.nodes.map((node: any) => ({
    ...node,
    status: node.type === 'start' ? 'completed' : 'pending'
  }))
  
  updateJob(jobId, {
    workflowPlan: { ...workflowPlan, nodes: resetNodes }
  })
  
  console.log(`🔄 Workflow reset completed. Total nodes: ${resetNodes.length}`)
  console.log(`📋 Reset node types:`, resetNodes.map((n: any) => `${n.id}(${n.type})`).join(', '))

  // Execute tasks in dependency order
  const completedTasks = new Set(['start'])
  const runningTasks = new Set()

  while (completedTasks.size - 1 < initialTaskNodes.length) { // -1 for start node
    // Check execution controller first
    const controller = executionControllers.get(jobId)
    if (controller?.shouldStop || controller?.shouldPause) {
      console.log(`Workflow execution ${controller.shouldPause ? 'paused' : 'stopped'} via controller for job ${jobId}`)
      break
    }
    
    // Check job status - pause/stop execution if needed
    const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (!currentJob || currentJob.status === 'paused' || currentJob.status === 'ready') {
      console.log(`Workflow execution ${currentJob?.status === 'paused' ? 'paused' : 'stopped'} for job ${jobId}`)
      break
    }
    
    // Find tasks that can run (all dependencies completed)
    // Always get current workflow state to avoid stale node references
    const currentJobState = useStore.getState().jobs.find(j => j.id === jobId)
    if (!currentJobState?.workflowPlan) {
      console.warn(`Job ${jobId} or workflow plan not found during task filtering`)
      break
    }
    
    const currentTaskNodes = currentJobState.workflowPlan.nodes.filter((n: any) => n.type === 'task')
    console.log(`🔍 Checking ready tasks. CompletedTasks: [${Array.from(completedTasks).join(', ')}], RunningTasks: [${Array.from(runningTasks).join(', ')}]`)
    
    const readyTasks = currentTaskNodes.filter((task: any) => {
      const isReady = task.status === 'pending' && 
        task.dependencies.every((dep: string) => completedTasks.has(dep)) &&
        !runningTasks.has(task.id) &&
        !completedTasks.has(task.id) // Prevent re-execution of completed tasks
      
      // Debug log
      if (task.status === 'pending') {
        console.log(`Task ${task.id} check:`, {
          status: task.status,
          dependencies: task.dependencies,
          completedTasks: Array.from(completedTasks),
          depsCompleted: task.dependencies.every((dep: string) => completedTasks.has(dep)),
          isRunning: runningTasks.has(task.id),
          isAlreadyCompleted: completedTasks.has(task.id),
          isReady
        })
      }
      
      return isReady
    })

    if (readyTasks.length === 0) {
      // Check if we have running tasks
      if (runningTasks.size > 0) {
        // Wait for running tasks to complete, but check job status while waiting
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check controller after waiting
        const controllerAfterWait = executionControllers.get(jobId)
        if (controllerAfterWait?.shouldStop || controllerAfterWait?.shouldPause) {
          console.log(`Workflow execution ${controllerAfterWait.shouldPause ? 'paused' : 'stopped'} via controller while waiting`)
          break
        }
        
        // Check job status again after waiting
        const jobAfterWait = useStore.getState().jobs.find(j => j.id === jobId)
        if (!jobAfterWait || jobAfterWait.status === 'paused' || jobAfterWait.status === 'ready') {
          console.log(`Workflow execution ${jobAfterWait?.status === 'paused' ? 'paused' : 'stopped'} while waiting for running tasks`)
          break
        }
        continue
      } else {
        // No ready tasks and no running tasks - workflow stuck
        break
      }
    }

    // Start ready tasks with staggered delays to allow parallel execution
    console.log(`🎲 Found ${readyTasks.length} ready tasks:`, readyTasks.map(t => `${t.id}(${t.title})`))
    
    // Start all tasks with staggered delays but don't wait for completion
    readyTasks.forEach((task, index) => {
      const delay = index * 1000 // 1 second delay between starts
      
      // Add to running tasks IMMEDIATELY to prevent duplicate scheduling
      runningTasks.add(task.id)
      console.log(`📝 Pre-scheduled task ${task.id} (${task.title}) with ${delay}ms delay for job ${jobId}`)
      console.log(`🏃 runningTasks now contains:`, Array.from(runningTasks))
      
      setTimeout(() => {
        console.log(`🚀 Actually starting task ${task.id} (${task.title}) after ${delay}ms delay`)
        
        // Update task status to running immediately (with safe update)
        updateTaskStatus(jobId, task.id, 'running', {
          currentTask: `Executing: ${task.title}`,
          logs: [`🚀 Starting task: ${task.title}`]
        })
        
        // Execute task with proper Promise handling
        console.log(`📞 Calling executeTask for ${task.id} (${task.title})`)
        console.log(`📋 Task ${task.id} details:`, { 
          id: task.id, 
          title: task.title, 
          dependencies: task.dependencies,
          status: task.status 
        })
        executeTask(jobId, task, workDirectory, aiProvider, openaiModel, claudeModel)
          .then(() => {
            // Mark as completed
            runningTasks.delete(task.id)
            completedTasks.add(task.id)
            
            console.log(`✅ Task ${task.id} completed successfully. CompletedTasks:`, Array.from(completedTasks))
            
            // Update task status to completed (with safe update)
            updateTaskStatus(jobId, task.id, 'completed', {
              progress: Math.round((completedTasks.size - 1) / initialTaskNodes.length * 100),
              logs: [`✅ Task completed: ${task.title}`]
            })
          })
          .catch((error) => {
            // Mark as failed
            runningTasks.delete(task.id)
            console.error(`❌ Task ${task.id} failed:`, error)
            
            // Update task status to failed (with safe update)
            updateTaskStatus(jobId, task.id, 'failed', {
              logs: [`❌ Task failed: ${task.title} - ${error instanceof Error ? error.message : String(error)}`]
            })
          })
      }, delay)
    })

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Check if all tasks completed successfully
  const finalJob = useStore.getState().jobs.find(j => j.id === jobId)
  if (finalJob?.workflowPlan) {
    const controller = executionControllers.get(jobId)
    
    // Don't mark as failed if manually paused/stopped
    if (controller?.shouldPause) {
      console.log('Execution paused - maintaining paused status')
      // Status already set to paused, don't change it
    } else if (controller?.shouldStop) {
      console.log('Execution stopped - status already set to ready')
      // Status already set to ready, don't change it
    } else {
      // Normal completion check - use current task nodes from final job state
      const finalTaskNodes = finalJob.workflowPlan.nodes.filter((n: any) => n.type === 'task')
      const allTasksCompleted = finalTaskNodes.every((task: any) => task.status === 'completed')
      
      updateJob(jobId, {
        status: allTasksCompleted ? 'completed' : 'failed',
        currentTask: allTasksCompleted ? 'All tasks completed!' : 'Some tasks failed',
        progress: 100
      })
    }
  }
  
  // Cleanup execution controller
  executionControllers.delete(jobId)
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
  console.log(`🎯 executeTask called for ${task.id} (${task.title}) - jobId: ${jobId}`)
  console.log(`📋 Task details:`, { task, workDirectory })
  const { updateJob } = useStore.getState()
  
  // Create prompt for Claude Code CLI (using spaces instead of newlines for command line compatibility)
  const prompt = `Task: ${task.title}. Description: ${task.description}. Working Directory: ${workDirectory}. Please complete this task step by step. You have access to all MCP tools for file operations, terminal commands, and any other capabilities you need. Work in the specified directory and complete the task fully. IMPORTANT: When you have successfully finished the task, end your response with exactly "###TASK_SUCCESS###" (no quotes). If the task fails for any reason, end your response with exactly "###TASK_FAILED###" (no quotes). This is critical for automated tracking.`

  try {
    // Validate Claude CLI before execution via electron API
    const validation = await window.electronAPI.validateClaudeEnvironment()
    
    if (!validation.isValid) {
      const errorMsg = `Claude CLI 실행 불가: ${validation.errors.join('; ')}`
      console.error(errorMsg)
      
      // Add detailed error to job logs
      const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
      if (currentJob) {
        updateJob(jobId, {
          logs: [...(currentJob.logs || []), 
            `❌ ${errorMsg}`,
            `💡 해결방법: Claude Code가 올바르게 설치되어 있는지 확인하세요`,
            `📍 터미널에서 'claude --version' 명령어를 실행해보세요`
          ]
        })
      }
      
      throw new Error(errorMsg)
    }
    
    console.log(`✅ Claude CLI validated: ${validation.claudePath}`)
    console.log(`🔧 MCP Servers: ${validation.mcpServers.join(', ') || 'None'}`)
    
    // Log validation info
    const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (currentJob) {
      updateJob(jobId, {
        logs: [...(currentJob.logs || []), 
          `🔍 Claude CLI: ${validation.claudePath}`,
          `🔧 MCP Servers: ${validation.mcpServers.join(', ') || 'None configured'}`,
          `🚀 Starting task: ${task.title}`
        ]
      })
    }

    // Execute Claude directly instead of using terminal
    await executeClaudeDirectly(prompt, task.id, workDirectory, validation.claudePath!, jobId, task)
    console.log(`✅ Claude execution completed for task ${task.id}`)

  } catch (error: unknown) {
    console.error(`❌ executeTask failed for ${task.id}:`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to execute task: ${errorMessage}`)
  }
}

// Execute Claude directly without terminal
async function executeClaudeDirectly(prompt: string, taskId: string, workDirectory: string, claudePath: string, jobId: string, task: any) {
  console.log(`🎯 executeClaudeDirectly called for ${taskId}`)
  const { updateJob } = useStore.getState()
  
  try {
    // Execute Claude with prompt as argument
    const result = await window.electronAPI.executeClaudeCommand({
      claudePath,
      args: ['-p', prompt],
      workDirectory,
      timeout: 300000, // 5 minutes
      env: {}
    })
    
    console.log(`📤 Claude execution result:`, result)
    
    // Log Claude's response to execution logs
    const updatedJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (updatedJob) {
      const responseLog = []
      
      if (result.success) {
        console.log(`✅ Task ${taskId} completed successfully`)
        responseLog.push(`✅ Task completed: ${task.title}`)
        
        // Add Claude's response if it exists and is not empty
        if (result.output && result.output.trim()) {
          responseLog.push(`📝 Claude 응답:`)
          // Split long responses into multiple log entries for better readability
          const responseLines = result.output.trim().split('\n')
          responseLines.forEach((line) => {
            if (line.trim()) {
              // Limit line length for better readability in logs
              const truncatedLine = line.length > 120 ? line.substring(0, 120) + '...' : line
              responseLog.push(`   ${truncatedLine}`)
            }
          })
        }
      } else {
        console.error(`❌ Task ${taskId} failed:`, result.error)
        responseLog.push(`❌ Task failed: ${task.title}`)
        responseLog.push(`💬 Error: ${result.error}`)
        throw new Error(`Claude execution failed: ${result.error}`)
      }
      
      updateJob(jobId, {
        logs: [...(updatedJob.logs || []), ...responseLog]
      })
    }
    
    if (!result.success) {
      throw new Error(`Claude execution failed: ${result.error}`)
    }
    
  } catch (error) {
    console.error(`❌ executeClaudeDirectly failed for ${taskId}:`, error)
    throw error
  }
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
    savedJobs = JSON.parse(localStorage.getItem('jobs') || '[]').map((job: any) => {
      // Reset running/paused/failed jobs to ready state on app restart
      let status = job.status || 'pending'
      if (status === 'running' || status === 'paused' || status === 'failed') {
        status = 'ready'
      }
      
      // Reset workflow node statuses if job was running, paused, or failed
      let workflowPlan = job.workflowPlan
      if (workflowPlan && (job.status === 'running' || job.status === 'paused' || job.status === 'failed')) {
        workflowPlan = {
          ...workflowPlan,
          nodes: workflowPlan.nodes.map((node: any) => ({
            ...node,
            status: node.type === 'start' ? 'completed' : 
                   (node.status === 'running' || node.status === 'failed') ? 'pending' : 
                   node.status
          }))
        }
      }
      
      return {
        ...job,
        createdAt: new Date(job.createdAt),
        workflowPlan,
        // Ensure required properties exist
        logs: job.logs || [],
        status,
        progress: job.progress || 0,
        currentTask: status === 'ready' ? 'Ready to resume' : (job.currentTask || '')
      }
    })
  } catch (error) {
    console.warn('Failed to load saved jobs from localStorage:', error)
    savedJobs = []
  }
  
  const savedActiveJobId = localStorage.getItem('active_job_id') || null
  
  // Validate active job ID exists in saved jobs
  const validActiveJobId = savedJobs.find((job: Job) => job.id === savedActiveJobId) ? savedActiveJobId : null
  
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
    
    // Note: clearAllTerminals API doesn't exist, skip this step
    
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
    console.log('pauseJob called with jobId:', jobId)
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    console.log('Found job:', job)
    if (job && job.status === 'running') {
      console.log('Job is running, attempting to pause...')
      try {
        if ((window.electronAPI as any).pauseJob) {
          console.log('Calling electronAPI.pauseJob...')
          const result = await (window.electronAPI as any).pauseJob(jobId)
          console.log('pauseJob result:', result)
          if (result.success) {
            console.log('pauseJob succeeded, updating state...')
            
            // Set execution controller to pause
            const controller = executionControllers.get(jobId)
            if (controller) {
              controller.shouldPause = true
              console.log('Execution controller set to pause')
            }
            
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
            console.log('State updated successfully')
          } else {
            console.error('pauseJob failed:', result.error)
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
    if (job && (job.status === 'paused' || job.status === 'failed')) {
      // For failed jobs, reset failed tasks to pending and restart from failed point
      if (job.status === 'failed' && job.workflowPlan) {
        console.log(`🔄 Resuming failed job ${jobId}...`)
        
        // Reset failed and pending tasks to pending, keep completed tasks as completed
        const resetNodes = job.workflowPlan.nodes.map((node: any) => {
          if (node.type === 'task') {
            if (node.status === 'failed') {
              console.log(`🔄 Resetting failed task ${node.id} to pending`)
              return { ...node, status: 'pending' }
            } else if (node.status === 'running') {
              console.log(`🔄 Resetting running task ${node.id} to pending`)
              return { ...node, status: 'pending' }
            }
            // Keep completed tasks as completed
          } else if (node.type === 'end') {
            // Reset end node to pending if it was failed
            return { ...node, status: 'pending' }
          }
          return node
        })
        
        const updatedWorkflowPlan = {
          ...job.workflowPlan,
          nodes: resetNodes
        }
        
        set(state => ({
          jobs: state.jobs.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'running' as const,
                  currentTask: 'Resuming from failed tasks...',
                  logs: [...j.logs, '🔄 Resuming execution from failed point'],
                  workflowPlan: updatedWorkflowPlan
                }
              : j
          ),
          layoutMode: 'executing',
          focusedPanel: 'output'
        }))
        
        // Execute the workflow tasks from the failed point
        try {
          console.log('🔄 Restarting workflow execution from failed point for job:', jobId)
          await executeWorkflowTasks(jobId, { ...job, workflowPlan: updatedWorkflowPlan, status: 'running' })
        } catch (error) {
          console.error('Failed to resume workflow execution:', error)
          const errorMessage = error instanceof Error ? error.message : String(error)
          set(state => ({
            jobs: state.jobs.map(j => 
              j.id === jobId 
                ? { 
                    ...j, 
                    status: 'failed' as const,
                    currentTask: `Resume failed: ${errorMessage}`,
                    logs: [...j.logs, `❌ Resume failed: ${errorMessage}`]
                  }
                : j
            )
          }))
        }
      } else if (job.status === 'paused') {
        // Original paused job resume logic
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
    }
  },

  stopJob: async (jobId) => {
    console.log('stopJob called with jobId:', jobId)
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    console.log('Found job for stop:', job)
    if (job && (job.status === 'running' || job.status === 'paused')) {
      console.log('Job can be stopped, attempting...')
      try {
        if ((window.electronAPI as any).stopJob) {
          console.log('Calling electronAPI.stopJob...')
          const result = await (window.electronAPI as any).stopJob(jobId)
          console.log('stopJob result:', result)
          if (result.success) {
            console.log('stopJob succeeded, updating state...')
            
            // Set execution controller to stop
            const controller = executionControllers.get(jobId)
            if (controller) {
              controller.shouldStop = true
              console.log('Execution controller set to stop')
            }
            
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
