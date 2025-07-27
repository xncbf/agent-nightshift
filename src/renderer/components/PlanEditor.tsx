import React, { useState } from 'react'
import { TaskNode, WorkflowPlan, LoopConfig } from '../types/workflow'
import { Trash2, Save, X, Plus, RotateCw, Settings } from 'lucide-react'

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
  const [showLoopsSection, setShowLoopsSection] = useState(false)
  const [editingLoopId, setEditingLoopId] = useState<string | null>(null)
  const [creatingLoop, setCreatingLoop] = useState(false)
  const [newLoop, setNewLoop] = useState<Partial<LoopConfig>>({
    startTaskId: '',
    endTaskId: '',
    maxAttempts: 3,
    condition: 'until-success'
  })

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
    
    // Calculate position based on last task or start node
    let newPosition = { x: 100, y: 100 }
    if (lastTaskNode) {
      const lastTaskNodeFull = workflowPlan.nodes.find(n => n.id === lastTaskNode.id)
      if (lastTaskNodeFull?.position) {
        newPosition = { 
          x: lastTaskNodeFull.position.x + 250, 
          y: lastTaskNodeFull.position.y 
        }
      }
    } else {
      const startNode = workflowPlan.nodes.find(n => n.type === 'start')
      if (startNode?.position) {
        newPosition = { 
          x: startNode.position.x + 250, 
          y: startNode.position.y 
        }
      }
    }
    
    const newTask: TaskNode = {
      id: newTaskId,
      title: `Task ${newTaskNumber}`,
      description: `New task ${newTaskNumber} - click to edit`,
      type: 'task',
      status: 'pending',
      position: newPosition,
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

  const handleDeleteLoop = (loopId: string) => {
    const updatedLoops = (workflowPlan.loops || []).filter(loop => loop.id !== loopId)
    onPlanUpdate({
      ...workflowPlan,
      loops: updatedLoops
    })
  }

  const handleUpdateLoop = (loopId: string, updates: Partial<LoopConfig>) => {
    const updatedLoops = (workflowPlan.loops || []).map(loop =>
      loop.id === loopId ? { ...loop, ...updates } : loop
    )
    onPlanUpdate({
      ...workflowPlan,
      loops: updatedLoops
    })
  }

  const getTaskTitle = (taskId: string) => {
    const task = workflowPlan.nodes.find(n => n.id === taskId)
    const taskIndex = workflowPlan.nodes.filter(n => n.type === 'task').findIndex(n => n.id === taskId)
    return task ? `#${taskIndex + 2} ${task.title}` : taskId
  }

  const handleCreateLoop = () => {
    if (!newLoop.startTaskId || !newLoop.endTaskId) return
    
    const loopId = `loop-${newLoop.startTaskId}-${newLoop.endTaskId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const createdLoop: LoopConfig = {
      id: loopId,
      startTaskId: newLoop.startTaskId!,
      endTaskId: newLoop.endTaskId!,
      condition: newLoop.condition as 'until-success' | 'max-attempts',
      maxAttempts: newLoop.maxAttempts,
      onFailure: 'continue',
      currentAttempt: 0  // Mark as accepted/active immediately
    }
    
    onPlanUpdate({
      ...workflowPlan,
      loops: [...(workflowPlan.loops || []), createdLoop]
    })
    
    // Reset form
    setCreatingLoop(false)
    setNewLoop({
      startTaskId: '',
      endTaskId: '',
      maxAttempts: 3,
      condition: 'until-success'
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Task Plan</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLoopsSection(!showLoopsSection)}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
                showLoopsSection ? 'bg-blue-600' : ''
              }`}
              style={{
                backgroundColor: showLoopsSection ? 'var(--color-nightshift-accent)' : 'var(--color-nightshift-darker)',
                color: 'white',
                border: '1px solid var(--color-nightshift-accent)'
              }}
              title="Manage loops"
            >
              <RotateCw className="w-4 h-4" />
              Loops ({(workflowPlan.loops || []).length})
            </button>
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
        </div>
        <div className="text-sm text-gray-400 mb-2">
          {workflowPlan.nodes.filter(n => n.type === 'task').length} tasks • Est. {workflowPlan.estimatedDuration} minutes
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-2 pr-4">
        {/* Loops Section */}
        {showLoopsSection && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '2px solid var(--color-nightshift-accent)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <RotateCw className="w-4 h-4" />
                Loop Management
              </h4>
              <button
                onClick={() => setCreatingLoop(!creatingLoop)}
                className="text-xs px-2 py-1 rounded flex items-center gap-1"
                style={{
                  backgroundColor: creatingLoop ? 'var(--color-nightshift-error)' : 'var(--color-nightshift-accent)',
                  color: 'white'
                }}
              >
                {creatingLoop ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {creatingLoop ? 'Cancel' : 'Add Loop'}
              </button>
            </div>
            
            {creatingLoop && (
              <div className="mb-4 p-3 rounded-md" style={{ backgroundColor: 'var(--color-nightshift-light)', border: '1px solid var(--color-nightshift-accent)' }}>
                <h5 className="text-sm font-medium mb-2">Create New Loop</h5>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400">Start Task:</label>
                    <select
                      value={newLoop.startTaskId}
                      onChange={(e) => setNewLoop({ ...newLoop, startTaskId: e.target.value })}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
                    >
                      <option value="">Select start task...</option>
                      {workflowPlan.nodes.filter(n => n.type === 'task').map((task, index) => (
                        <option key={task.id} value={task.id}>
                          #{index + 2} {task.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400">End Task:</label>
                    <select
                      value={newLoop.endTaskId}
                      onChange={(e) => setNewLoop({ ...newLoop, endTaskId: e.target.value })}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
                      disabled={!newLoop.startTaskId}
                    >
                      <option value="">Select end task...</option>
                      {workflowPlan.nodes.filter(n => {
                        if (n.type !== 'task') return false
                        if (!newLoop.startTaskId) return false
                        // End task must be after start task
                        const taskNodes = workflowPlan.nodes.filter(node => node.type === 'task')
                        const startIndex = taskNodes.findIndex(t => t.id === newLoop.startTaskId)
                        const currentIndex = taskNodes.findIndex(t => t.id === n.id)
                        return currentIndex > startIndex
                      }).map((task) => {
                        const taskIndex = workflowPlan.nodes.filter(n => n.type === 'task').findIndex(n => n.id === task.id)
                        return (
                          <option key={task.id} value={task.id}>
                            #{taskIndex + 2} {task.title}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400">Condition:</label>
                    <select
                      value={newLoop.condition}
                      onChange={(e) => setNewLoop({ ...newLoop, condition: e.target.value as 'until-success' | 'max-attempts' })}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
                    >
                      <option value="until-success">Until Success</option>
                      <option value="max-attempts">Max Attempts</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-400">Max Attempts:</label>
                    <input
                      type="number"
                      value={newLoop.maxAttempts}
                      onChange={(e) => setNewLoop({ ...newLoop, maxAttempts: parseInt(e.target.value) || 3 })}
                      className="w-full px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
                      min="1"
                      max="10"
                    />
                  </div>
                  
                  <button
                    onClick={handleCreateLoop}
                    disabled={!newLoop.startTaskId || !newLoop.endTaskId}
                    className="w-full px-3 py-1 rounded text-sm"
                    style={{
                      backgroundColor: (!newLoop.startTaskId || !newLoop.endTaskId) ? '#4b5563' : 'var(--color-nightshift-success)',
                      color: 'white',
                      cursor: (!newLoop.startTaskId || !newLoop.endTaskId) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Create Loop
                  </button>
                </div>
              </div>
            )}
            
            {(workflowPlan.loops || []).length === 0 && !creatingLoop ? (
              <p className="text-sm text-gray-400">No loops configured yet. Click "Add Loop" to create one.</p>
            ) : (workflowPlan.loops || []).length > 0 && (
              <div className="space-y-2">
                {(workflowPlan.loops || []).map(loop => (
                  <div 
                    key={loop.id} 
                    className="p-3 rounded-md" 
                    style={{ backgroundColor: 'var(--color-nightshift-light)', border: '1px solid #3b82f6' }}
                  >
                    {editingLoopId === loop.id ? (
                      // Edit mode
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Max Attempts:</label>
                          <input
                            type="number"
                            value={loop.maxAttempts || 3}
                            onChange={(e) => handleUpdateLoop(loop.id, { maxAttempts: parseInt(e.target.value) || 3 })}
                            className="w-20 px-2 py-1 rounded text-sm"
                            style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
                            min="1"
                            max="10"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Current Attempt:</label>
                          <span className="text-sm">{loop.currentAttempt || 0}</span>
                        </div>
                        <button
                          onClick={() => setEditingLoopId(null)}
                          className="btn-success text-xs px-2 py-1"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      // Display mode
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400">
                              🔄 Loop
                            </span>
                            <span className="text-sm">
                              {getTaskTitle(loop.startTaskId)} → {getTaskTitle(loop.endTaskId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingLoopId(loop.id)}
                              className="p-1 rounded hover:bg-gray-700"
                              title="Edit loop"
                            >
                              <Settings className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteLoop(loop.id)}
                              className="p-1 rounded hover:bg-red-500/20 text-red-400"
                              title="Delete loop"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          Attempts: {loop.currentAttempt || 0}/{loop.maxAttempts || 3}
                          {loop.condition && ` • Condition: ${loop.condition}`}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tasks Section */}
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