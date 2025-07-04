import React, { useCallback } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TaskNode as WorkflowTaskNode } from '../types/workflow'
import { TaskNode } from './nodes/TaskNode'

const nodeTypes = {
  task: TaskNode,
}

interface WorkflowDAGProps {
  nodes: WorkflowTaskNode[]
  edges: any[]
  onNodeClick?: (node: WorkflowTaskNode) => void
}

export const WorkflowDAG: React.FC<WorkflowDAGProps> = ({
  nodes: workflowNodes,
  edges: workflowEdges,
  onNodeClick
}) => {
  // Convert workflow nodes to ReactFlow nodes
  const initialNodes: Node[] = workflowNodes.map(node => ({
    id: node.id,
    type: 'task',
    position: node.position,
    data: {
      ...node,
      onClick: () => onNodeClick?.(node)
    },
  }))

  // Convert workflow edges to ReactFlow edges
  const initialEdges: Edge[] = workflowEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'default',
    style: { stroke: 'var(--color-nightshift-light)' },
    animated: edge.source === getCurrentRunningNode()?.id,
  }))

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when workflow nodes change
  React.useEffect(() => {
    setNodes(workflowNodes.map(node => ({
      id: node.id,
      type: 'task',
      position: node.position,
      data: {
        ...node,
        onClick: () => onNodeClick?.(node)
      },
    })))
  }, [workflowNodes, onNodeClick, setNodes])

  // Update edges when workflow edges change
  React.useEffect(() => {
    setEdges(workflowEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      style: { 
        stroke: '#6b7280', 
        strokeWidth: 2,
        opacity: 0.8
      },
      animated: edge.source === getCurrentRunningNode()?.id,
    })))
  }, [workflowEdges, setEdges])

  function getCurrentRunningNode() {
    return workflowNodes.find(node => node.status === 'running')
  }

  return (
    <div className="w-full h-full" style={{ backgroundColor: 'var(--color-nightshift-darker)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        style={{ backgroundColor: 'transparent' }}
      >
        <Background 
          color="var(--color-nightshift-light)" 
          gap={20} 
          size={1}
        />
        <MiniMap 
          style={{
            backgroundColor: 'var(--color-nightshift-darker)',
            border: '1px solid var(--color-nightshift-light)',
            borderRadius: '8px'
          }}
          nodeColor={(n) => {
            if (n.data?.status === 'completed') return 'var(--color-nightshift-success)'
            if (n.data?.status === 'running') return 'var(--color-nightshift-warning)'
            return 'var(--color-nightshift-light)'
          }}
        />
      </ReactFlow>
    </div>
  )
}