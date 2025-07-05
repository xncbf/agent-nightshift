import React, { useState } from 'react'
import { TaskNode, WorkflowPlan } from '../types/workflow'
import { Trash2, Save, X, Plus } from 'lucide-react'

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
    console.log('Editing node:', {
      id: node.id,
      title: node.title,
      dependencies: node.dependencies,
      nodeDependencies: node.dependencies || []
    })
    
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

    // Update edges based on new dependencies
    const editedNode = updatedNodes.find(n => n.id === editingNodeId)
    if (!editedNode) return

    // Remove old edges pointing to this node
    let updatedEdges = workflowPlan.edges.filter(e => e.target !== editingNodeId)

    // Add new edges based on dependencies
    if (editForm.dependencies.length === 0) {
      // If no dependencies, connect from start
      updatedEdges.push({ 
        id: `start-${editingNodeId}`, 
        source: 'start', 
        target: editingNodeId 
      })
    } else {
      // Create edges from each dependency
      editForm.dependencies.forEach(depId => {
        updatedEdges.push({ 
          id: `${depId}-${editingNodeId}`, 
          source: depId, 
          target: editingNodeId 
        })
      })
    }

    // Ensure edges to nodes that depend on this one are preserved
    workflowPlan.edges.forEach(edge => {
      if (edge.source === editingNodeId && !updatedEdges.find(e => e.id === edge.id)) {
        updatedEdges.push(edge)
      }
    })

    const updatedPlan = {
      ...workflowPlan,
      nodes: updatedNodes,
      edges: updatedEdges
    }

    // Debug log to verify updates
    console.log('Updated task dependencies:', {
      taskId: editingNodeId,
      oldDependencies: workflowPlan.nodes.find(n => n.id === editingNodeId)?.dependencies,
      newDependencies: editForm.dependencies,
      newEdges: updatedEdges.filter(e => e.target === editingNodeId)
    })

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

  const handleAddTask = () => {
    const taskNodes = workflowPlan.nodes.filter(n => n.type === 'task')
    const newTaskId = `task${taskNodes.length + 1}`
    const newTaskNumber = taskNodes.length + 1
    
    // Find the end node to update its dependencies
    const endNodeIndex = workflowPlan.nodes.findIndex(n => n.type === 'end')
    const lastTaskNode = taskNodes[taskNodes.length - 1]
    
    const newTask: TaskNode = {
      id: newTaskId,
      title: `Task ${newTaskNumber}`,
      description: `New task ${newTaskNumber} - click to edit`,
      type: 'task',
      status: 'pending',
      position: { x: 100, y: 250 + (newTaskNumber - 1) * 150 },
      duration: 10,
      dependencies: lastTaskNode ? [lastTaskNode.id] : ['start']
    }

    // Update nodes
    const updatedNodes = [...workflowPlan.nodes]
    
    // Insert new task before end node
    if (endNodeIndex !== -1) {
      updatedNodes.splice(endNodeIndex, 0, newTask)
      // Update end node dependencies
      updatedNodes[endNodeIndex + 1] = {
        ...updatedNodes[endNodeIndex + 1],
        dependencies: [newTaskId]
      }
    } else {
      updatedNodes.push(newTask)
    }

    // Update edges
    const updatedEdges = [...workflowPlan.edges]
    
    // Remove old edge to end node if it exists
    if (lastTaskNode && endNodeIndex !== -1) {
      const oldEdgeIndex = updatedEdges.findIndex(e => e.source === lastTaskNode.id && e.target === 'end')
      if (oldEdgeIndex !== -1) {
        updatedEdges.splice(oldEdgeIndex, 1)
      }
    }
    
    // Add new edges
    const sourceId = lastTaskNode ? lastTaskNode.id : 'start'
    updatedEdges.push({ id: `${sourceId}-${newTaskId}`, source: sourceId, target: newTaskId })
    
    if (endNodeIndex !== -1) {
      updatedEdges.push({ id: `${newTaskId}-end`, source: newTaskId, target: 'end' })
    }

    const updatedPlan = {
      ...workflowPlan,
      nodes: updatedNodes,
      edges: updatedEdges,
      estimatedDuration: workflowPlan.estimatedDuration + 10
    }

    onPlanUpdate(updatedPlan)
    
    // Start editing the new task
    setEditingNodeId(newTaskId)
    setEditForm({
      title: newTask.title,
      description: newTask.description,
      dependencies: newTask.dependencies
    })
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Task Plan</h3>
          <button
            onClick={handleAddTask}
            className="flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors"
            style={{
              backgroundColor: 'var(--color-nightshift-accent)',
              color: 'white'
            }}
            title="Add new task"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
        <div className="text-sm text-gray-400 mb-2">
          {workflowPlan.nodes.filter(n => n.type === 'task').length} tasks • Est. {workflowPlan.estimatedDuration} minutes
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
                  {/* Debug: Show current dependencies */}
                  <div className="text-xs text-gray-500 mb-2">
                    Current: {editForm.dependencies.length > 0 ? editForm.dependencies.join(', ') : 'None'}
                  </div>
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
                              {potentialParent.type === 'start' ? '#1 Start' : 
                               `#${workflowPlan.nodes.filter(n => n.type === 'task').findIndex(n => n.id === potentialParent.id) + 2} ${potentialParent.title}`}
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