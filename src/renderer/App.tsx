import React, { useEffect } from 'react'
import { PRDEditor } from './components/PRDEditor'
import { WorkflowStatus } from './components/WorkflowStatus'
import { LiveOutput } from './components/LiveOutput'
import { Footer } from './components/Footer'
import { LayoutTransition } from './components/LayoutTransition'
import { useStore } from './store/useStore'

function App() {
  const { updateJob, layoutMode } = useStore()

  useEffect(() => {
    // Set up IPC listeners for job updates
    const unsubscribeJobUpdate = window.electronAPI.onJobUpdate((event, data) => {
      console.log('Job update received:', data)
      updateJob(data.jobId, data.updates)
    })

    const unsubscribeLogUpdate = window.electronAPI.onLogUpdate((event, data) => {
      console.log('Log update received:', data)
      updateJob(data.jobId, {
        logs: data.logs
      })
    })

    // Cleanup listeners on unmount
    return () => {
      unsubscribeJobUpdate()
      unsubscribeLogUpdate()
    }
  }, [updateJob])

  // Simulate job updates for demo purposes
  useEffect(() => {
    const interval = setInterval(() => {
      const { jobs, updateJob } = useStore.getState()
      const runningJob = jobs.find(job => job.status === 'running') // Only process running jobs, not paused
      
      if (runningJob && runningJob.workflowPlan) {
        const { workflowPlan } = runningJob
        const taskNodes = workflowPlan.nodes.filter(n => n.type === 'task')
        const completedTasks = taskNodes.filter(n => n.status === 'completed')
        const runningTask = taskNodes.find(n => n.status === 'running')
        const pendingTasks = taskNodes.filter(n => n.status === 'pending')
        
        // If no task is running but there are pending tasks, start the next one
        if (!runningTask && pendingTasks.length > 0) {
          const nextTask = pendingTasks[0]
          const updatedNodes = workflowPlan.nodes.map(n =>
            n.id === nextTask.id ? { ...n, status: 'running' as const } : n
          )
          
          updateJob(runningJob.id, {
            workflowPlan: { ...workflowPlan, nodes: updatedNodes },
            currentTask: `Executing: ${nextTask.title}`,
            logs: [...runningJob.logs, `> Starting ${nextTask.title}...`]
          })
        }
        
        // If there's a running task, potentially complete it
        if (runningTask && Math.random() > 0.7) {
          const updatedNodes = workflowPlan.nodes.map(n =>
            n.id === runningTask.id ? { ...n, status: 'completed' as const } : n
          )
          
          const newCompletedCount = completedTasks.length + 1
          const totalTasks = taskNodes.length
          const progress = Math.min(Math.round((newCompletedCount / totalTasks) * 100), 100)
          
          updateJob(runningJob.id, {
            workflowPlan: { ...workflowPlan, nodes: updatedNodes },
            progress,
            currentTask: newCompletedCount >= totalTasks ? 'All tasks completed!' : 'Preparing next task...',
            logs: [...runningJob.logs, `✓ Completed ${runningTask.title}`],
            status: newCompletedCount >= totalTasks ? 'completed' : 'running'
          })
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-nightshift-dark)' }}>
      {/* Title Bar */}
      <header className="h-12 flex items-center justify-between px-4 drag-region" style={{ backgroundColor: 'var(--color-nightshift-darker)', borderBottom: '1px solid var(--color-nightshift-light)' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌙</span>
          <h1 className="text-lg font-semibold">Claude Code Nightshift</h1>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Mode:</span>
          <span 
            className="px-2 py-1 rounded-md font-medium transition-all duration-300"
            style={{ 
              backgroundColor: layoutMode === 'editing' ? 'var(--color-nightshift-accent)' :
                              layoutMode === 'planning' ? 'var(--color-nightshift-warning)' :
                              'var(--color-nightshift-success)',
              color: 'white'
            }}
          >
            {layoutMode === 'editing' ? '✏️ Editing' :
             layoutMode === 'planning' ? '🎯 Planning' :
             '⚡ Executing'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* PRD Editor Panel */}
        <section 
          className={`layout-panel p-6 ${
            layoutMode === 'editing' ? 'panel-large' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-small'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
        >
          <div className="layout-panel-content h-full">
            <PRDEditor />
          </div>
        </section>

        {/* Workflow Status Panel */}
        <section 
          className={`layout-panel p-6 ${
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-full' :
            'panel-medium'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
        >
          <div className="layout-panel-content h-full">
            <WorkflowStatus />
          </div>
        </section>

        {/* Live Output Panel */}
        <section 
          className={`layout-panel p-6 ${
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-medium'
          }`}
        >
          <div className="layout-panel-content h-full">
            <LiveOutput />
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
      
      {/* Layout Transition Indicator */}
      <LayoutTransition />
    </div>
  )
}

export default App