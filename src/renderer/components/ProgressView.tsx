import React from 'react'
import { useStore } from '../store/useStore'
import { CheckCircle, Clock, Zap, XCircle, Play, Pause, Square, Terminal } from 'lucide-react'

export const ProgressView: React.FC = () => {
  const { jobs, activeJobId, pauseJob, resumeJob, stopJob } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)

  if (!activeJob || !activeJob.workflowPlan) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>No active workflow to monitor</p>
      </div>
    )
  }

  // If job is ready (not yet started), show waiting message
  if (activeJob.status === 'ready') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="w-16 h-16 mb-4 mx-auto rounded-full flex items-center justify-center" 
               style={{ backgroundColor: 'var(--color-nightshift-warning)' + '20' }}>
            <Clock className="w-8 h-8" style={{ color: 'var(--color-nightshift-warning)' }} />
          </div>
          <h3 className="text-lg font-medium mb-2">Workflow Ready</h3>
          <p className="text-sm mb-4 max-w-md">
            The workflow plan has been generated and is ready for execution. 
            Please approve the plan to start processing.
          </p>
          <div className="text-xs text-gray-600">
            {activeJob.workflowPlan.nodes.filter(n => n.type === 'task').length} tasks • 
            Est. {activeJob.workflowPlan.estimatedDuration} minutes
          </div>
        </div>
      </div>
    )
  }

  const { workflowPlan } = activeJob
  const completedTasks = workflowPlan.nodes.filter(n => n.status === 'completed' && n.type === 'task').length
  const totalTasks = workflowPlan.nodes.filter(n => n.type === 'task').length
  const currentTask = workflowPlan.nodes.find(n => n.status === 'running')

  const getTaskIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-nightshift-success)' }} />
      case 'failed':
        return <XCircle className="w-5 h-5" style={{ color: 'var(--color-nightshift-error)' }} />
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-400" />
      case 'skipped':
        return <Play className="w-5 h-5 text-gray-400" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getProgressPercentage = () => {
    if (totalTasks === 0) return 0
    return Math.min(Math.round((completedTasks / totalTasks) * 100), 100)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Execution Progress</h2>
          
          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {activeJob.status === 'running' && (
              <button
                onClick={() => pauseJob(activeJob.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-nightshift-warning)', color: 'white' }}
                title="Pause execution"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            
            {activeJob.status === 'paused' && (
              <button
                onClick={() => resumeJob(activeJob.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-nightshift-success)', color: 'white' }}
                title="Resume execution"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}
            
            {(activeJob.status === 'running' || activeJob.status === 'paused') && (
              <button
                onClick={() => stopJob(activeJob.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-nightshift-error)', color: 'white' }}
                title="Stop execution"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-medium">{getProgressPercentage()}%</span>
          </div>
          <div className="w-full h-3 rounded-full" style={{ backgroundColor: 'var(--color-nightshift-darker)' }}>
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{
                backgroundColor: 'var(--color-nightshift-accent)',
                width: `${getProgressPercentage()}%`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{completedTasks} of {totalTasks} tasks completed</span>
            <span>Est. {workflowPlan.estimatedDuration} min total</span>
          </div>
        </div>

        {/* Current Task */}
        {currentTask && (
          <div 
            className="p-4 rounded-lg mb-4"
            style={{ 
              backgroundColor: 'var(--color-nightshift-light)',
              border: '1px solid var(--color-nightshift-warning)'
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              {activeJob.status === 'paused' ? (
                <Pause className="w-5 h-5 text-orange-400" />
              ) : (
                <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
              )}
              <span className="font-medium">
                {activeJob.status === 'paused' ? 'Paused' : 'Currently Running'}
              </span>
            </div>
            <h3 className="font-semibold mb-1">{currentTask.title}</h3>
            <p className="text-sm text-gray-400">{currentTask.description}</p>
            {currentTask.duration && (
              <div className="mt-2 text-xs text-gray-500">
                ⏱️ Est. {currentTask.duration} minutes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto pr-4">
        <h3 className="text-lg font-medium mb-3">All Tasks</h3>
        <div className="space-y-3">
          {workflowPlan.nodes
            .filter(node => node.type !== 'start' && node.type !== 'end')
            .map((node, index) => (
            <div
              key={node.id}
              className={`p-3 rounded-lg transition-all duration-200 ${
                node.status === 'running' ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''
              }`}
              style={{
                backgroundColor: node.status === 'running' 
                  ? 'var(--color-nightshift-light)' 
                  : 'var(--color-nightshift-darker)',
                border: '1px solid var(--color-nightshift-light)'
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getTaskIcon(node.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                    <h4 className="font-medium truncate">{node.title}</h4>
                  </div>
                  
                  <p className="text-sm text-gray-400 mb-2">{node.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: node.status === 'completed' ? 'var(--color-nightshift-success)' + '20' :
                                          node.status === 'running' ? 'var(--color-nightshift-warning)' + '20' :
                                          node.status === 'failed' ? 'var(--color-nightshift-error)' + '20' :
                                          '#6b728020',
                          color: node.status === 'completed' ? 'var(--color-nightshift-success)' :
                                 node.status === 'running' ? 'var(--color-nightshift-warning)' :
                                 node.status === 'failed' ? 'var(--color-nightshift-error)' :
                                 '#6b7280'
                        }}
                      >
                        {node.status}
                      </span>
                      
                      {/* Terminal View Button */}
                      <button
                        onClick={() => {
                          // Switch to terminal tab for this task
                          const terminalEvent = new CustomEvent('switchTerminal', { 
                            detail: { terminalId: node.id } 
                          })
                          window.dispatchEvent(terminalEvent)
                          
                          // Switch to output panel
                          const { setFocusedPanel } = useStore.getState()
                          setFocusedPanel('output')
                        }}
                        className="p-1 rounded hover:bg-opacity-20 transition-colors"
                        style={{
                          backgroundColor: 'var(--color-nightshift-accent)' + '10',
                          color: 'var(--color-nightshift-accent)'
                        }}
                        title={`View terminal for ${node.title}`}
                      >
                        <Terminal className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {node.duration && (
                      <span className="text-xs text-gray-500">
                        {node.duration}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}