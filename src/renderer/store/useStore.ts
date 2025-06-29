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
  
  // UI State
  isSubmitting: boolean
  setIsSubmitting: (value: boolean) => void
  layoutMode: 'editing' | 'planning' | 'executing'
  setLayoutMode: (mode: 'editing' | 'planning' | 'executing') => void
  focusedPanel: 'prd' | 'workflow' | 'output' | null
  setFocusedPanel: (panel: 'prd' | 'workflow' | 'output' | null) => void
  
  // AI Configuration
  aiProvider: 'openai' | 'claude-code'
  setAiProvider: (provider: 'openai' | 'claude-code') => void
  openaiModel: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo'
  setOpenaiModel: (model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') => void
  openaiApiKey: string
  setOpenaiApiKey: (key: string) => void
  isOpenaiConfigured: boolean
  isAIConfigured: boolean
}

export const useStore = create<AppState>((set, get) => {
  // Load saved preferences from localStorage
  const savedApiKey = localStorage.getItem('openai_api_key') || ''
  const savedProvider = (localStorage.getItem('ai_provider') as 'openai' | 'claude-code') || 'openai'
  const savedModel = (localStorage.getItem('openai_model') as 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') || 'gpt-4o-mini'
  
  return {
  // PRD Editor
  currentPRD: '',
  setCurrentPRD: (prd) => set({ currentPRD: prd }),
  
  // Jobs
  jobs: [],
  activeJobId: null,
  
  addJob: async (prd) => {
    const { submitPRD } = window.electronAPI
    
    set({ isSubmitting: true })
    
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
        
        set(state => ({
          jobs: [...state.jobs, newJob],
          activeJobId: result.jobId,
          currentPRD: '',
          isSubmitting: false,
          layoutMode: 'planning',
          focusedPanel: 'workflow'
        }))
        
        // Generate workflow plan with WorkflowAI
        setTimeout(async () => {
          const { WorkflowAI } = await import('../services/workflowAI')
          
          // Create a log function that updates the job's logs
          const addLogToJob = (log: string) => {
            set(state => ({
              jobs: state.jobs.map(job => 
                job.id === result.jobId 
                  ? { ...job, logs: [...job.logs, log] } 
                  : job
              )
            }))
          }
          
          // Get current AI provider settings
          const currentState = get()
          const workflowAI = new WorkflowAI(
            addLogToJob, 
            currentState.aiProvider, 
            currentState.openaiModel
          )
          
          try {
            // AI will automatically detect if it's single or multiple prompts
            const workflowPlan = await workflowAI.analyzeContentAndGenerateWorkflow(prd)
            
            set(state => ({
              jobs: state.jobs.map(job => 
                job.id === result.jobId 
                  ? { 
                      ...job, 
                      workflowPlan,
                      status: 'ready',
                      currentTask: 'Workflow plan ready for review. Please approve to start execution.',
                      logs: [...job.logs, '⏳ Waiting for approval...']
                    } 
                  : job
              )
            }))
          } catch (error) {
            console.error('Failed to generate workflow plan:', error)
            const errorMessage = error instanceof Error ? error.message : String(error)
            set(state => ({
              jobs: state.jobs.map(job => 
                job.id === result.jobId 
                  ? { 
                      ...job, 
                      status: 'failed',
                      currentTask: 'Failed to generate workflow plan',
                      logs: [...job.logs, `❌ Failed to generate workflow plan: ${errorMessage}`]
                    } 
                  : job
              )
            }))
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
  
  updateJob: (id, updates) => set(state => ({
    jobs: state.jobs.map(job => 
      job.id === id ? { ...job, ...updates } : job
    )
  })),
  
  setActiveJob: (id) => set({ activeJobId: id }),
  
  approveWorkflowPlan: async (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'ready') {
      set(state => ({
        jobs: state.jobs.map(j => 
          j.id === jobId 
            ? { 
                ...j, 
                status: 'running',
                currentTask: 'Starting execution...',
                logs: [...j.logs, '✓ Workflow approved', '> Starting execution...']
              }
            : j
        ),
        layoutMode: 'executing',
        focusedPanel: 'output'
      }))

      // Execute the workflow with Claude Code CLI (if available)
      try {
        console.log('Starting Claude Code execution for job:', jobId)
        // Note: executeWorkflow may not be implemented yet in Electron API
        if ((window.electronAPI as any).executeWorkflow) {
          const result = await window.electronAPI.executeWorkflow(jobId, job.prd)
          console.log('Claude Code execution started:', result)
        } else {
          console.log('executeWorkflow not implemented yet - using simulation')
        }
      } catch (error) {
        console.error('Failed to start Claude Code execution:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        set(state => ({
          jobs: state.jobs.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'failed',
                  currentTask: 'Failed to start execution',
                  logs: [...j.logs, `❌ Execution failed: ${errorMessage}`]
                }
              : j
          )
        }))
      }
    }
  },
  
  rejectWorkflowPlan: (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'ready') {
      set(state => ({
        jobs: state.jobs.map(j => 
          j.id === jobId 
            ? { 
                ...j, 
                status: 'failed',
                currentTask: 'Workflow plan rejected',
                logs: [...j.logs, '✗ Workflow rejected by user']
              }
            : j
        ),
        layoutMode: 'editing'
      }))
    }
  },

  pauseJob: async (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'running') {
      try {
        if ((window.electronAPI as any).pauseJob) {
          const result = await window.electronAPI.pauseJob(jobId)
          if (result.success) {
            set(state => ({
              jobs: state.jobs.map(j => 
                j.id === jobId 
                  ? { 
                      ...j, 
                      status: 'paused',
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
                    status: 'paused',
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
          const result = await window.electronAPI.resumeJob(jobId)
          if (result.success) {
            set(state => ({
              jobs: state.jobs.map(j => 
                j.id === jobId 
                  ? { 
                      ...j, 
                      status: 'running',
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
                    status: 'running',
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
          const result = await window.electronAPI.stopJob(jobId)
          if (result.success) {
            set(state => ({
              jobs: state.jobs.map(j => 
                j.id === jobId 
                  ? { 
                      ...j, 
                      status: 'failed',
                      currentTask: 'Execution stopped by user',
                      logs: [...j.logs, '⏹️ Execution stopped']
                    }
                  : j
              ),
              layoutMode: 'editing'
            }))
          }
        } else {
          // Fallback - just update the status
          set(state => ({
            jobs: state.jobs.map(j => 
              j.id === jobId 
                ? { 
                    ...j, 
                    status: 'failed',
                    currentTask: 'Execution stopped by user',
                    logs: [...j.logs, '⏹️ Execution stopped']
                  }
                : j
            ),
            layoutMode: 'editing'
          }))
        }
      } catch (error) {
        console.error('Failed to stop job:', error)
      }
    }
  },
  
  // UI State
  isSubmitting: false,
  setIsSubmitting: (value) => set({ isSubmitting: value }),
  layoutMode: 'editing',
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  focusedPanel: null,
  setFocusedPanel: (panel) => set({ focusedPanel: panel }),
  
  // AI Configuration
  aiProvider: savedProvider,
  setAiProvider: (provider: 'openai' | 'claude-code') => {
    set({ aiProvider: provider })
    localStorage.setItem('ai_provider', provider)
    
    // Update isAIConfigured
    const state = get()
    set({ isAIConfigured: provider === 'claude-code' || (provider === 'openai' && !!state.openaiApiKey) })
  },
  openaiModel: savedModel,
  setOpenaiModel: (model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') => {
    set({ openaiModel: model })
    localStorage.setItem('openai_model', model)
  },
  
  // OpenAI API
  openaiApiKey: savedApiKey,
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
    set({ isAIConfigured: state.aiProvider === 'claude-code' || (state.aiProvider === 'openai' && !!key) })
  },
  isOpenaiConfigured: !!savedApiKey,
  
  // Computed state
  isAIConfigured: savedProvider === 'claude-code' || (savedProvider === 'openai' && !!savedApiKey)
  }
})