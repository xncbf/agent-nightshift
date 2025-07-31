import React, { useEffect, useState } from 'react'
import { PromptsEditor } from './components/PromptsEditor'
import { WorkflowStatus } from './components/WorkflowStatus'
import { ExecutionLogs } from './components/ExecutionLogs'
import { Footer } from './components/Footer'
import { LayoutTransition } from './components/LayoutTransition'
import { LoopNotification } from './components/LoopNotification'
import { LoopConfigModal } from './components/LoopConfigModal'
import { useStore } from './store/useStore'
import type { LoopConfig } from './types/workflow'

function App() {
  const { 
    updateJob, 
    layoutMode, 
    focusedPanel, 
    setFocusedPanel, 
    jobs,
    activeJobId
  } = useStore()
  const [pendingLoops, setPendingLoops] = useState<LoopConfig[]>([])
  const [editingLoop, setEditingLoop] = useState<LoopConfig | null>(null)
  
  const activeJob = jobs.find(job => job.id === activeJobId)

  // Initialize pending loops when workflow plan is loaded
  useEffect(() => {
    if (activeJob?.workflowPlan?.loops && activeJob.status === 'ready') {
      // Filter out loops that have already been processed (have currentAttempt set)
      const unprocessedLoops = activeJob.workflowPlan.loops.filter(loop => 
        loop.currentAttempt === undefined || loop.currentAttempt === null
      )
      
      // Also filter out loops that overlap with already accepted loops
      const acceptedLoops = activeJob.workflowPlan.loops.filter(loop => 
        loop.currentAttempt !== undefined && loop.currentAttempt !== null
      )
      
      const nonOverlappingLoops = unprocessedLoops.filter(unprocessedLoop => {
        // Check if this loop overlaps with any accepted loop
        return !acceptedLoops.some(acceptedLoop => 
          (acceptedLoop.startTaskId === unprocessedLoop.startTaskId && 
           acceptedLoop.endTaskId === unprocessedLoop.endTaskId) ||
          (acceptedLoop.startTaskId === unprocessedLoop.startTaskId) ||
          (acceptedLoop.endTaskId === unprocessedLoop.endTaskId)
        )
      })
      
      setPendingLoops(nonOverlappingLoops)
    } else {
      setPendingLoops([])
    }
  }, [activeJob?.workflowPlan, activeJob?.status])

  const handleLoopAccept = (loop: LoopConfig) => {
    if (activeJob?.workflowPlan) {
      const updatedPlan = {
        ...activeJob.workflowPlan,
        loops: [...(activeJob.workflowPlan.loops || []).filter(l => l.id !== loop.id), { ...loop, currentAttempt: 0 }]
      }
      updateJob(activeJob.id, { workflowPlan: updatedPlan })
      setPendingLoops(pendingLoops.filter(l => l.id !== loop.id))
    }
  }

  const handleLoopReject = (loopId: string) => {
    if (activeJob?.workflowPlan) {
      const updatedPlan = {
        ...activeJob.workflowPlan,
        loops: (activeJob.workflowPlan.loops || []).filter(l => l.id !== loopId)
      }
      updateJob(activeJob.id, { workflowPlan: updatedPlan })
    }
    setPendingLoops(pendingLoops.filter(l => l.id !== loopId))
  }

  const handleLoopModify = (loop: LoopConfig) => {
    setEditingLoop(loop)
  }

  const handleLoopSave = (updatedLoop: LoopConfig) => {
    handleLoopAccept(updatedLoop)
    setEditingLoop(null)
  }



  useEffect(() => {
    // Set up IPC listeners for job updates
    const unsubscribeJobUpdate = window.electronAPI.onJobUpdate((_event, data) => {
      console.log('Job update received:', data)
      updateJob(data.jobId, data.updates)
    })

    const unsubscribeLogUpdate = window.electronAPI.onLogUpdate((_event, data) => {
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


  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-nightshift-dark)' }}>
      {/* Title Bar */}
      <header className="h-12 flex items-center justify-between px-4 drag-region relative" style={{ backgroundColor: 'var(--color-nightshift-darker)', borderBottom: '1px solid var(--color-nightshift-light)' }}>
        {/* Empty left side for balance */}
        <div className="flex-1"></div>
        
        {/* Center title */}
        <div className="flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
          <span className="text-2xl">🌙</span>
          <h1 className="text-lg font-semibold">Agent Nightshift</h1>
        </div>
        
        {/* Right side with Mode */}
        <div className="flex items-center gap-4 text-sm no-drag flex-1 justify-end" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'prd' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-small'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
          onClick={() => {
            // Always focus when clicking anywhere in the panel
            if (focusedPanel !== 'prd') {
              setFocusedPanel('prd')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <PromptsEditor />
          </div>
        </section>

        {/* Workflow Status Panel */}
        <section 
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'workflow' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-full' :
            'panel-small'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
          onClick={() => {
            // Always focus when clicking anywhere in the panel
            if (focusedPanel !== 'workflow') {
              setFocusedPanel('workflow')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <WorkflowStatus />
          </div>
        </section>

        {/* Execution Logs Panel */}
        <section 
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'output' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-small'
          }`}
          onClick={() => {
            // Always focus when clicking anywhere in the panel
            if (focusedPanel !== 'output') {
              setFocusedPanel('output')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <ExecutionLogs />
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
      
      {/* Layout Transition Indicator */}
      <LayoutTransition />
      

      {/* Loop Notification - Shows in bottom right corner */}
      {pendingLoops.length > 0 && activeJob?.workflowPlan && (
        <LoopNotification
          loops={pendingLoops}
          tasks={activeJob.workflowPlan.nodes}
          onAccept={handleLoopAccept}
          onReject={handleLoopReject}
          onModify={handleLoopModify}
        />
      )}

      {/* Loop Configuration Modal */}
      {editingLoop && activeJob?.workflowPlan && (
        <LoopConfigModal
          loop={editingLoop}
          taskTitles={Object.fromEntries(
            activeJob.workflowPlan.nodes.map(n => [n.id, n.title])
          )}
          onSave={handleLoopSave}
          onCancel={() => setEditingLoop(null)}
        />
      )}
    </div>
  )
}

export default App
