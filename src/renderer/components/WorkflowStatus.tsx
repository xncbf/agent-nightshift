import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { WorkflowDAG } from './WorkflowDAG'
import { PlanEditor } from './PlanEditor'
import { ProgressView } from './ProgressView'
import { TaskNode, WorkflowPlan } from '../types/workflow'
import { BarChart3, Network, CheckCircle, XCircle, Clock, List, Activity, Folder, Settings } from 'lucide-react'

export const WorkflowStatus: React.FC = () => {
  const { jobs, activeJobId, approveWorkflowPlan, rejectWorkflowPlan, resumeJob, updateJob, workDirectory, setWorkDirectory } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const [showDirectorySettings, setShowDirectorySettings] = useState(true)
  // Set default view mode based on job status
  const getDefaultViewMode = () => {
    if (!activeJob) return 'dag'
    if (activeJob.status === 'running' || activeJob.status === 'paused') return 'progress'
    if (activeJob.status === 'ready') return 'dag'
    return 'dag'
  }

  const [viewMode, setViewMode] = useState<'dag' | 'list' | 'progress'>(getDefaultViewMode())

  // Reset to DAG view when a new job is created
  React.useEffect(() => {
    if (activeJobId) {
      setViewMode('dag')
    }
  }, [activeJobId])

  // Don't auto-switch view mode - let user control it
  // React.useEffect(() => {
  //   if ((activeJob?.status === 'running' || activeJob?.status === 'paused') && viewMode !== 'progress') {
  //     setViewMode('progress')
  //   }
  // }, [activeJob?.status, viewMode])

  const handleNodeClick = (node: TaskNode) => {
    console.log('Node clicked:', node)
  }

  const handlePlanUpdate = (updatedPlan: WorkflowPlan) => {
    if (activeJob) {
      updateJob(activeJob.id, { workflowPlan: updatedPlan })
    }
  }

  const handleApprove = () => {
    if (activeJob && activeJob.status === 'ready') {
      approveWorkflowPlan(activeJob.id)
    }
  }

  const handleReject = () => {
    if (activeJob && activeJob.status === 'ready') {
      rejectWorkflowPlan(activeJob.id)
    }
  }

  if (!activeJob) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
        <p className="text-lg">No active job</p>
        <p className="text-sm mt-2">Describe your idea to get started</p>
      </div>
    )
  }

  if (!activeJob.workflowPlan && viewMode === 'dag') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-lg">Generating workflow plan...</p>
        <p className="text-sm mt-2">Claude is analyzing your PRD</p>
      </div>
    )
  }

  const getStatusIcon = () => {
    switch (activeJob.status) {
      case 'running':
        return (
          <div className="animate-pulse">
            ⚡
          </div>
        )
      case 'completed':
        return '✅'
      case 'failed':
        return '❌'
      default:
        return '⏳'
    }
  }

  const getStatusColor = () => {
    switch (activeJob.status) {
      case 'planning':
        return '#60a5fa'
      case 'ready':
        return 'var(--color-nightshift-warning)'
      case 'running':
        return 'var(--color-nightshift-warning)'
      case 'paused':
        return '#f97316' // orange
      case 'completed':
        return 'var(--color-nightshift-success)'
      case 'failed':
        return 'var(--color-nightshift-error)'
      default:
        return '#6b7280'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with view toggle */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getStatusIcon()}</span>
            <h2 className="text-xl font-semibold">Workflow Status</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDirectorySettings(!showDirectorySettings)
              }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: showDirectorySettings ? 'var(--color-nightshift-accent)' : 'var(--color-nightshift-darker)',
                color: showDirectorySettings ? 'white' : '#9ca3af'
              }}
              title="Work Directory Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewMode('dag')
              }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: viewMode === 'dag' ? 'var(--color-nightshift-accent)' : 'var(--color-nightshift-darker)',
                color: viewMode === 'dag' ? 'white' : '#9ca3af'
              }}
              title="DAG View"
            >
              <Network className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewMode('list')
              }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--color-nightshift-accent)' : 'var(--color-nightshift-darker)',
                color: viewMode === 'list' ? 'white' : '#9ca3af'
              }}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewMode('progress')
              }}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: viewMode === 'progress' ? 'var(--color-nightshift-accent)' : 'var(--color-nightshift-darker)',
                color: viewMode === 'progress' ? 'white' : '#9ca3af'
              }}
              title="Progress View"
            >
              <Activity className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="text-lg font-medium" style={{ color: getStatusColor() }}>
          Claude: {activeJob.status === 'running' ? 'Active' : 
                   activeJob.status === 'planning' ? 'Planning' :
                   activeJob.status === 'ready' ? 'Ready for Review' :
                   activeJob.status === 'paused' ? 'Paused' : activeJob.status}
        </div>
        
        {/* Approval buttons for ready status */}
        {activeJob.status === 'ready' && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleApprove()
              }}
              className="btn-success flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve & Execute
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleReject()
              }}
              className="btn-error flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}
        
        {/* Resume button for failed status */}
        {activeJob.status === 'failed' && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                resumeJob(activeJob.id)
              }}
              className="btn-warning flex items-center gap-2"
              style={{
                backgroundColor: 'var(--color-nightshift-warning)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              <Clock className="w-4 h-4" />
              Resume from Failed Point
            </button>
          </div>
        )}
        
        {/* Work Directory Settings */}
        {showDirectorySettings && (
          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Folder className="w-4 h-4" />
              <h3 className="font-medium">Work Directory</h3>
            </div>
            <p className="text-sm text-gray-400 mb-3">
              Claude Code agent will execute commands in this directory
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workDirectory}
                onChange={(e) => setWorkDirectory(e.target.value)}
                placeholder="/path/to/your/project"
                className="flex-1 px-3 py-2 rounded-md text-sm"
                style={{
                  backgroundColor: 'var(--color-nightshift-light)',
                  border: '1px solid var(--color-nightshift-accent)',
                  color: 'white'
                }}
              />
              <button
                onClick={async () => {
                  try {
                    // Use Electron's file dialog to select directory
                    const result = await window.electronAPI.selectDirectory()
                    if (result.filePaths && result.filePaths.length > 0) {
                      setWorkDirectory(result.filePaths[0])
                    }
                  } catch (error) {
                    console.warn('Directory selection not implemented yet')
                  }
                }}
                className="px-3 py-2 rounded-md text-sm"
                style={{ backgroundColor: 'var(--color-nightshift-accent)', color: 'white' }}
                title="Browse for directory"
              >
                Browse
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Current: {workDirectory}
            </div>
          </div>
        )}
      </div>

      {/* Content based on view mode */}
      <div className="flex-1 overflow-hidden transition-all duration-300 ease-in-out">
        {viewMode === 'dag' && activeJob.workflowPlan ? (
          <div className="h-full">
            <div className="mb-2 text-sm text-gray-400">
              Workflow Plan: {activeJob.workflowPlan.name}
            </div>
            <div className="h-full rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-nightshift-darker)' }}>
              <WorkflowDAG 
                nodes={activeJob.workflowPlan.nodes}
                edges={activeJob.workflowPlan.edges}
                onNodeClick={handleNodeClick}
              />
            </div>
          </div>
        ) : viewMode === 'list' && activeJob.workflowPlan ? (
          <div className="h-full">
            <PlanEditor 
              workflowPlan={activeJob.workflowPlan}
              onPlanUpdate={handlePlanUpdate}
            />
          </div>
        ) : viewMode === 'progress' ? (
          <div className="h-full">
            <ProgressView />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>No workflow plan available</p>
          </div>
        )}
      </div>
    </div>
  )
}