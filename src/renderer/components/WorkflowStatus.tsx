import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { WorkflowDAG } from './WorkflowDAG'
import { PlanEditor } from './PlanEditor'
import { ProgressView } from './ProgressView'
import { TaskNode, WorkflowPlan } from '../types/workflow'
import { BarChart3, Network, CheckCircle, XCircle, Clock, List, Activity } from 'lucide-react'

export const WorkflowStatus: React.FC = () => {
  const { jobs, activeJobId, approveWorkflowPlan, rejectWorkflowPlan, updateJob } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  // Set default view mode based on job status
  const getDefaultViewMode = () => {
    if (!activeJob) return 'dag'
    if (activeJob.status === 'running' || activeJob.status === 'paused') return 'progress'
    if (activeJob.status === 'ready') return 'dag'
    return 'dag'
  }

  const [viewMode, setViewMode] = useState<'dag' | 'list' | 'progress'>(getDefaultViewMode())

  // Update view mode when job status changes
  React.useEffect(() => {
    if ((activeJob?.status === 'running' || activeJob?.status === 'paused') && viewMode !== 'progress') {
      setViewMode('progress')
    }
  }, [activeJob?.status, viewMode])

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
            {(activeJob?.status === 'running' || activeJob?.status === 'paused') && (
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
            )}
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