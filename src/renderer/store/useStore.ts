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

// Terminal retry managers - each terminal has its own retry logic
const terminalRetryManagers = new Map<string, {
  retryCount: number
  maxRetries: number
  isRetrying: boolean
  lastAttemptTime: number
}>()

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

  // Create new nodes array with only the specific task updated
  const updatedNodes = currentJob.workflowPlan.nodes.map((n: any) =>
    n.id === taskId ? { ...n, status } : n
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
}

// Workflow execution function
async function executeWorkflowTasks(jobId: string, job: Job) {
  const { workflowPlan } = job
  if (!workflowPlan) return

  const { updateJob, workDirectory, aiProvider, openaiModel, claudeModel } = useStore.getState()
  
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
    const readyTasks = taskNodes.filter((task: any) => {
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
      
      setTimeout(() => {
        console.log(`🚀 Starting task ${task.id} (${task.title}) with ${delay}ms delay`)
        runningTasks.add(task.id)
        console.log(`🏃 runningTasks now contains:`, Array.from(runningTasks))
        
        // Update task status to running immediately (with safe update)
        updateTaskStatus(jobId, task.id, 'running', {
          currentTask: `Executing: ${task.title}`,
          logs: [`🚀 Starting task: ${task.title}`]
        })
        
        // Execute task with proper Promise handling
        console.log(`📞 Calling executeTask for ${task.id}`)
        executeTask(jobId, task, workDirectory, aiProvider, openaiModel, claudeModel)
          .then(() => {
            // Mark as completed
            runningTasks.delete(task.id)
            completedTasks.add(task.id)
            
            console.log(`✅ Task ${task.id} completed successfully. CompletedTasks:`, Array.from(completedTasks))
            
            // Update task status to completed (with safe update)
            updateTaskStatus(jobId, task.id, 'completed', {
              progress: Math.round((completedTasks.size - 1) / taskNodes.length * 100),
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
      // Normal completion check
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
  console.log(`🎯 executeTask called for ${task.id} (${task.title})`)
  const { updateJob } = useStore.getState()
  
  // Create prompt for Claude Code CLI (using spaces instead of newlines for command line compatibility)
  const prompt = `Task: ${task.title}. Description: ${task.description}. Working Directory: ${workDirectory}. Please complete this task step by step. You have access to all MCP tools for file operations, terminal commands, and any other capabilities you need. Work in the specified directory and complete the task fully. IMPORTANT: When you have successfully finished the task, end your response with exactly "###TASK_SUCCESS###" (no quotes). If the task fails for any reason, end your response with exactly "###TASK_FAILED###" (no quotes). This is critical for automated tracking.`

  try {
    console.log(`🔧 Initializing terminal for task ${task.id}`)
    // Create terminal for this task
    await initializeClaudeTerminal(task.id, workDirectory)
    console.log(`✅ Terminal initialized for task ${task.id}`)

    // Log the task start
    const currentJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (currentJob) {
      updateJob(jobId, {
        logs: [...(currentJob.logs || []), `🚀 Starting task: ${task.title}`]
      })
    }

    console.log(`🚀 Executing Claude with prompt for task ${task.id}`)
    // Execute Claude directly with prompt instead of interactive mode
    await executeClaudeWithPrompt(prompt, task.id, workDirectory)
    console.log(`✅ Claude execution completed for task ${task.id}`)

    // Log task completion (Note: in reality we'd monitor output to detect completion)
    const updatedJob = useStore.getState().jobs.find(j => j.id === jobId)
    if (updatedJob) {
      updateJob(jobId, {
        logs: [...(updatedJob.logs || []), `✅ Task sent to Claude: ${task.title}`]
      })
    }

  } catch (error: unknown) {
    console.error(`❌ executeTask failed for ${task.id}:`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to execute task: ${errorMessage}`)
  }
}

// Initialize terminal for Claude execution
async function initializeClaudeTerminal(terminalId: string, workDirectory: string) {
  try {
    console.log(`🔄 Creating terminal ${terminalId} in directory: ${workDirectory}`)
    
    // Add retry logic for terminal creation to prevent stuck terminals
    let terminalResult
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        terminalResult = await window.electronAPI.createTerminal(workDirectory, terminalId)
        if (terminalResult.success) {
          break
        } else {
          console.warn(`Terminal creation attempt ${retryCount + 1} failed: ${terminalResult.error}`)
        }
      } catch (error) {
        console.warn(`Terminal creation attempt ${retryCount + 1} error:`, error)
      }
      
      retryCount++
      if (retryCount < maxRetries) {
        console.log(`Retrying terminal creation in 2 seconds...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    if (!terminalResult?.success) {
      throw new Error(`Failed to create terminal after ${maxRetries} attempts: ${terminalResult?.error || 'Unknown error'}`)
    }

    // Set up terminal output monitoring
    let terminalOutput = ''
    let isTerminalReady = false
    
    const outputHandler = (_event: any, data: { terminalId: string; data: string }) => {
      if (data.terminalId === terminalId) {
        terminalOutput += data.data
        console.log(`Terminal ${terminalId} output:`, data.data.replace(/\r?\n/g, '\\n'))
        
        // Check for terminal readiness (prompt appeared)
        if (terminalOutput.includes('$') || terminalOutput.includes('%') || terminalOutput.includes('>')) {
          isTerminalReady = true
        }
      }
    }
    
    const unsubscribe = (window.electronAPI as any).onTerminalData(outputHandler)

    // Wait for terminal to be ready before sending commands
    console.log(`⏳ Waiting for terminal ${terminalId} to be ready...`)
    const terminalStartTime = Date.now()
    const terminalTimeout = 5000 // 5 seconds for terminal to be ready
    
    while (!isTerminalReady && (Date.now() - terminalStartTime) < terminalTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Clean up listener
    unsubscribe()
    
    if (!isTerminalReady) {
      console.warn(`Terminal ${terminalId} not ready after ${terminalTimeout/1000}s, proceeding anyway. Output: ${terminalOutput}`)
    } else {
      console.log(`✅ Terminal ${terminalId} is ready`)
    }

    // Change to working directory
    console.log(`📂 Changing to directory: ${workDirectory}`)
    await (window.electronAPI as any).sendTerminalInput(`cd "${workDirectory}"\n`, terminalId)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log(`✅ Terminal ${terminalId} initialized and ready for Claude execution`)
    
  } catch (error) {
    console.error('Failed to initialize Claude terminal:', error)
    throw error
  }
}

// Execute Claude directly with prompt instead of interactive mode
async function executeClaudeWithPrompt(prompt: string, terminalId: string, _workDirectory: string) {
  // Initialize retry manager for this terminal if not exists
  if (!terminalRetryManagers.has(terminalId)) {
    terminalRetryManagers.set(terminalId, {
      retryCount: 0,
      maxRetries: 2,
      isRetrying: false,
      lastAttemptTime: 0
    })
  }
  
  const retryManager = terminalRetryManagers.get(terminalId)!
  console.log(`🔥 executeClaudeWithPrompt called for terminal ${terminalId}, retry ${retryManager.retryCount}/${retryManager.maxRetries}`)
  
  // Check if we've exceeded max retries
  if (retryManager.retryCount > retryManager.maxRetries) {
    terminalRetryManagers.delete(terminalId)
    throw new Error(`Command failed to execute after ${retryManager.maxRetries + 1} attempts in terminal ${terminalId}`)
  }
  
  try {
    console.log(`🎧 Setting up output monitoring for terminal ${terminalId}`)
    // Set up output monitoring to detect when Claude finishes
    let terminalOutput = ''
    let isTaskComplete = false
    let commandStartTime: number
    let initialOutputLength = 0
    
    const outputHandler = (_event: any, data: { terminalId: string; data: string }) => {
      if (data.terminalId === terminalId) {
        terminalOutput += data.data
        console.log(`📥 Terminal ${terminalId} received data: ${data.data.length} chars`)
        
        // Check for task completion indicators with start time (only if command started)
        if (commandStartTime && isClaudeCommandComplete(terminalOutput, commandStartTime)) {
          isTaskComplete = true
        }
      }
    }
    
    console.log(`🔗 Subscribing to terminal data for ${terminalId}`)
    const unsubscribe = (window.electronAPI as any).onTerminalData(outputHandler)
    
    // Wait a moment to get current terminal state
    console.log(`⏳ Waiting 500ms to capture initial terminal state...`)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Capture initial terminal state
    initialOutputLength = terminalOutput.length
    console.log(`📸 Initial terminal output length: ${initialOutputLength} (retry ${retryManager.retryCount + 1}/${retryManager.maxRetries + 1})`)
    
    // Execute Claude directly with the prompt and skip permissions
    // Use single quotes to avoid escaping issues with double quotes in prompt
    const claudeCommand = `claude -p '${prompt.replace(/'/g, "'\"'\"'")}' --dangerously-skip-permissions\n`
    console.log(`🚀 Executing Claude command in terminal ${terminalId}`)
    console.log(`📝 Command length: ${claudeCommand.length}`)
    console.log(`📝 Prompt preview: ${prompt.substring(0, 100)}...`)
    
    console.log(`📤 Sending command to terminal ${terminalId}...`)
    await (window.electronAPI as any).sendTerminalInput(claudeCommand, terminalId)
    console.log(`✅ Command sent to terminal ${terminalId}`)
    
    // Set command start time after sending the command
    commandStartTime = Date.now()
    
    // Give Claude a moment to start before monitoring
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check if terminal output changed (command actually executed)
    const outputAfterCommand = terminalOutput.length
    const outputChanged = outputAfterCommand > initialOutputLength + 10 // Allow some margin
    
    if (!outputChanged) {
      console.warn(`⚠️ No terminal output change detected after 3 seconds (${initialOutputLength} -> ${outputAfterCommand})`)
      console.log(`📋 Current terminal output: "${terminalOutput.slice(-100)}"`) // Show last 100 chars
      
      if (retryManager.retryCount < retryManager.maxRetries) {
        retryManager.retryCount++
        retryManager.isRetrying = true
        retryManager.lastAttemptTime = Date.now()
        
        console.log(`🔄 Retrying command execution for terminal ${terminalId} (attempt ${retryManager.retryCount + 1}/${retryManager.maxRetries + 1})`)
        unsubscribe()
        
        // Clear terminal or send a simple command to refresh
        console.log(`🧹 Sending clear command to refresh terminal ${terminalId} state`)
        await (window.electronAPI as any).sendTerminalInput('echo "===RETRY==="\n', terminalId)
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Recursive retry with same parameters
        return executeClaudeWithPrompt(prompt, terminalId, _workDirectory)
      } else {
        unsubscribe()
        retryManager.isRetrying = false
        terminalRetryManagers.delete(terminalId) // Clean up
        console.error(`❌ Final attempt failed for terminal ${terminalId}. Terminal output: "${terminalOutput.slice(-200)}"`)
        throw new Error(`Command failed to execute after ${retryManager.maxRetries + 1} attempts - no terminal output change detected`)
      }
    }
    
    console.log(`✅ Terminal output changed: ${initialOutputLength} -> ${outputAfterCommand}, command appears to be running`)
    
    // Mark retry as successful
    retryManager.isRetrying = false
    
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
      const result = getTaskResult(terminalOutput)
      if (result === 'completed') {
        console.log(`✅ Task completed successfully in terminal ${terminalId}`)
      } else if (result === 'failed') {
        console.log(`❌ Task failed in terminal ${terminalId}`)
        throw new Error('Task failed - FAILED signal received from Claude')
      } else {
        console.log(`⚠️ Task finished with unknown result in terminal ${terminalId}`)
      }
    }
    
    // Clean up retry manager on successful completion
    terminalRetryManagers.delete(terminalId)
    
  } catch (error) {
    console.error(`Failed to execute Claude with prompt in terminal ${terminalId}:`, error)
    // Clean up retry manager on error
    terminalRetryManagers.delete(terminalId)
    throw error
  }
}

// Helper function to detect Claude Code CLI completion based on explicit signals
export function isClaudeCommandComplete(terminalOutput: string, commandStartTime: number): boolean {
  // Count occurrences of the signal to distinguish between prompt and actual result
  const successCount = (terminalOutput.match(/###TASK_SUCCESS###/g) || []).length
  const failedCount = (terminalOutput.match(/###TASK_FAILED###/g) || []).length
  
  // Must wait at least 5 seconds after command start to avoid detecting prompt
  const timeElapsed = Date.now() - commandStartTime
  const minWaitTime = 5000 // Reduced to 5 seconds
  
  // Debug logging
  console.log(`🔍 Completion check: successCount=${successCount}, failedCount=${failedCount}, timeElapsed=${timeElapsed}ms`)
  
  if (timeElapsed < minWaitTime) {
    console.log(`⏳ Waiting for minimum time (${minWaitTime}ms), current: ${timeElapsed}ms`)
    return false
  }
  
  // If we find the signal more than once, it means Claude actually responded with it
  // (once in prompt, once in response)
  if (successCount >= 2) {
    console.log('🎯 Task completion detected: ###TASK_SUCCESS### signal found in response')
    return true
  }
  
  if (failedCount >= 2) {
    console.log('🎯 Task completion detected: ###TASK_FAILED### signal found in response')
    return true
  }
  
  return false
}

// Helper function to check if task was successful or failed
export function getTaskResult(terminalOutput: string): 'completed' | 'failed' | 'unknown' {
  // Count occurrences to distinguish between prompt and actual result
  const successCount = (terminalOutput.match(/###TASK_SUCCESS###/g) || []).length
  const failedCount = (terminalOutput.match(/###TASK_FAILED###/g) || []).length
  
  console.log(`📊 Task result check: successCount=${successCount}, failedCount=${failedCount}`)
  
  // If signal appears 2 or more times, Claude actually responded with it
  if (successCount >= 2) {
    return 'completed'
  }
  
  if (failedCount >= 2) {
    return 'failed'
  }
  
  return 'unknown'
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
