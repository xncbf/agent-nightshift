import React, { useState } from 'react'
import { TaskNode, WorkflowPlan } from '../types/workflow'
import { Trash2, Save, X } from 'lucide-react'

interface PlanEditorProps {
  workflowPlan: WorkflowPlan
  onPlanUpdate: (plan: WorkflowPlan) => void
}

export const PlanEditor: React.FC<PlanEditorProps> = ({ workflowPlan, onPlanUpdate }) => {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    title: string
    description: string
    dependencies: string[]
  }>({ title: '', description: '', dependencies: [] })

  const handleEditStart = (node: TaskNode) => {
    setEditingNodeId(node.id)
    setEditForm({
      title: node.title,
      description: node.description,
      dependencies: node.dependencies || []
    })
  }

  const handleEditSave = () => {
    if (!editingNodeId) return

    const updatedNodes = workflowPlan.nodes.map(node =>
      node.id === editingNodeId
        ? {
            ...node,
            title: editForm.title,
            description: editForm.description,
            dependencies: editForm.dependencies
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
    setEditForm({ title: '', description: '', dependencies: [] })
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
              border: editingNodeId === node.id ? '2px solid var(--color-nightshift-accent)' : '1px solid #6b7280',
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
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <span className="flex items-center gap-2">
                      🔗 Dependencies (Parent Tasks)
                      <span className="text-xs text-gray-400">(tasks that must complete before this one)</span>
                    </span>
                  </label>
                  <div className="space-y-1">
                    {workflowPlan.nodes
                      .filter(n => n.id !== node.id && n.type !== 'end') // Don't allow self or end as dependency
                      .map(potentialParent => {
                        const isSelected = editForm.dependencies.includes(potentialParent.id)
                        return (
                          <label
                            key={potentialParent.id}
                            className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors"
                            style={{
                              backgroundColor: isSelected ? 'var(--color-nightshift-accent)' + '20' : 'var(--color-nightshift-light)',
                              border: isSelected ? '1px solid var(--color-nightshift-accent)' : '1px solid #6b7280'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditForm({
                                    ...editForm,
                                    dependencies: [...editForm.dependencies, potentialParent.id]
                                  })
                                } else {
                                  setEditForm({
                                    ...editForm,
                                    dependencies: editForm.dependencies.filter(id => id !== potentialParent.id)
                                  })
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">
                              #{workflowPlan.nodes.findIndex(n => n.id === potentialParent.id) + 1} {potentialParent.title}
                            </span>
                          </label>
                        )
                      })
                    }
                    {workflowPlan.nodes.filter(n => n.id !== node.id && n.type !== 'end').length === 0 && (
                      <p className="text-xs text-gray-500 italic">No available parent tasks</p>
                    )}
                  </div>
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
              // Display mode - Make entire area clickable for editing
              <div
                className="cursor-pointer"
                onClick={() => node.type === 'task' && handleEditStart(node)}
                title={node.type === 'task' ? 'Click to edit task' : ''}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{index + 1}</span>
                    <h4 className="font-medium">{node.title}</h4>
                    {getStatusBadge(node.status)}
                  </div>
                  
                  {node.type === 'task' && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                
                {/* Show dependencies */}
                {node.dependencies && node.dependencies.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2">
                    🔗 Depends on: {node.dependencies.map(depId => {
                      const depNode = workflowPlan.nodes.find(n => n.id === depId)
                      return depNode ? `#${workflowPlan.nodes.findIndex(n => n.id === depId) + 1} ${depNode.title}` : depId
                    }).join(', ')}
                  </div>
                )}
                
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