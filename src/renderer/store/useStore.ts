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
}

export const useStore = create<AppState>((set, get) => ({
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
        
        // Simulate workflow plan generation
        setTimeout(async () => {
          const { ClaudeCodeService } = await import('../services/claudeCodeService')
          const service = new ClaudeCodeService()
          
          try {
            const workflowPlan = await service.analyzePRD(prd)
            
            set(state => ({
              jobs: state.jobs.map(job => 
                job.id === result.jobId 
                  ? { 
                      ...job, 
                      workflowPlan,
                      status: 'ready',
                      currentTask: 'Workflow plan ready for review. Please approve to start execution.',
                      logs: [...job.logs, '✓ Workflow plan generated', `> Found ${workflowPlan.nodes.length} tasks to execute`, '⏳ Waiting for approval...']
                    } 
                  : job
              )
            }))
          } catch (error) {
            console.error('Failed to generate workflow plan:', error)
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
  
  approveWorkflowPlan: (jobId) => {
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

  pauseJob: (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'running') {
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
  },

  resumeJob: (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && job.status === 'paused') {
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
  },

  stopJob: (jobId) => {
    const { jobs } = get()
    const job = jobs.find(j => j.id === jobId)
    if (job && (job.status === 'running' || job.status === 'paused')) {
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
  },
  
  // UI State
  isSubmitting: false,
  setIsSubmitting: (value) => set({ isSubmitting: value }),
  layoutMode: 'editing',
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  focusedPanel: null,
  setFocusedPanel: (panel) => set({ focusedPanel: panel })
}))