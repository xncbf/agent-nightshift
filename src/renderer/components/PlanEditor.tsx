import React, { useState } from 'react'
import { TaskNode, WorkflowPlan } from '../types/workflow'
import { Edit3, Plus, Trash2, Save, X } from 'lucide-react'

interface PlanEditorProps {
  workflowPlan: WorkflowPlan
  onPlanUpdate: (plan: WorkflowPlan) => void
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ workflowPlan, onPlanUpdate }) => {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    title: string
    description: string
  }>({ title: '', description: '' })

  const handleEditStart = (node: TaskNode) => {
    setEditingNodeId(node.id)
    setEditForm({
      title: node.title,
      description: node.description
    })
  }

  const handleEditSave = () => {
    if (!editingNodeId) return

    const updatedNodes = workflowPlan.nodes.map(node =>
      node.id === editingNodeId
        ? {
            ...node,
            title: editForm.title,
            description: editForm.description
          }
        : node
    )

    const updatedPlan = {
      ...workflowPlan,
      nodes: updatedNodes
    }

    onPlanUpdate(updatedPlan)
    setEditingNodeId(null)
  }

  const handleEditCancel = () => {
    setEditingNodeId(null)
    setEditForm({ title: '', description: '' })
  }

  const handleDeleteNode = (nodeId: string) => {
    // Don't allow deletion of start/end nodes
    const node = workflowPlan.nodes.find(n => n.id === nodeId)
    if (node && (node.type === 'start' || node.type === 'end')) return

    const updatedNodes = workflowPlan.nodes.filter(n => n.id !== nodeId)
    const updatedEdges = workflowPlan.edges.filter(e => e.source !== nodeId && e.target !== nodeId)

    const updatedPlan = {
      ...workflowPlan,
      nodes: updatedNodes,
      edges: updatedEdges
    }

    onPlanUpdate(updatedPlan)
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: '#6b7280',
      running: '#f59e0b',
      completed: '#22c55e',
      failed: '#ef4444'
    }
    
    return (
      <span 
        className="px-2 py-1 rounded-full text-xs font-medium"
        style={{ 
          backgroundColor: colors[status as keyof typeof colors] + '20',
          color: colors[status as keyof typeof colors]
        }}
      >
        {status}
      </span>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Task Plan</h3>
        <div className="text-sm text-gray-400 mb-2">
          {workflowPlan.nodes.length} tasks • Est. {workflowPlan.estimatedDuration} minutes
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-2 pr-4">
        {workflowPlan.nodes.map((node, index) => (
          <div
            key={node.id}
            className="p-4 rounded-lg transition-all duration-200"
            style={{ 
              backgroundColor: 'var(--color-nightshift-darker)',
              border: '1px solid #6b7280',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }}
          >
            {editingNodeId === node.id ? (
              // Edit mode
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <span className="flex items-center gap-2">
                      📝 Task Summary
                      <span className="text-xs text-gray-400">(one-line description for humans)</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="e.g., Create React TypeScript Project"
                    className="w-full px-3 py-2 rounded-md border text-sm"
                    style={{
                      backgroundColor: 'var(--color-nightshift-light)',
                      border: '2px solid var(--color-nightshift-accent)',
                      color: '#f3f4f6',
                      boxShadow: '0 2px 4px rgba(74, 95, 216, 0.1)'
                    }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <span className="flex items-center gap-2">
                      🤖 Agent Instructions
                      <span className="text-xs text-gray-400">(detailed commands for AI to execute)</span>
                    </span>
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    placeholder="e.g., Run 'npx create-react-app task-dashboard --template typescript', install dependencies: @types/react-router-dom@5.3.3, axios@1.4.0..."
                    className="w-full px-3 py-2 rounded-md border text-sm resize-none font-mono"
                    style={{
                      backgroundColor: 'var(--color-nightshift-light)',
                      border: '2px solid var(--color-nightshift-accent)',
                      color: '#f3f4f6',
                      boxShadow: '0 2px 4px rgba(74, 95, 216, 0.1)',
                      fontSize: '12px',
                      lineHeight: '1.4'
                    }}
                  />
                </div>
                
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleEditSave}
                    className="btn-success flex items-center gap-1 text-sm"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="btn-error flex items-center gap-1 text-sm"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Display mode
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                    <h4 className="font-medium">{node.title}</h4>
                    {getStatusBadge(node.status)}
                  </div>
                  
                  {node.type === 'task' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditStart(node)}
                        className="p-1 rounded-md transition-colors border border-gray-600 hover:border-blue-500 hover:bg-blue-500/10"
                        title="Edit task"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteNode(node.id)}
                        className="p-1 rounded-md transition-colors border border-gray-600 hover:border-red-500 hover:bg-red-500/10"
                        title="Delete task"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-400 mb-2">{node.description}</p>
                
                {node.duration && (
                  <div className="text-xs text-gray-500">
                    ⏱️ ~{node.duration} minutes
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}