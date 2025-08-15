import React, { useCallback, useMemo, useEffect } from 'react'
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
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TaskNode as WorkflowTaskNode, LoopConfig } from '../types/workflow'
import { TaskNode } from './nodes/TaskNode'

const nodeTypes = {
  task: TaskNode,
}

interface WorkflowDAGProps {
  nodes: WorkflowTaskNode[]
  edges: any[]
  loops?: LoopConfig[]
  onNodeClick?: (node: WorkflowTaskNode) => void
}

const WorkflowDAGInner: React.FC<WorkflowDAGProps> = ({
  nodes: workflowNodes,
  edges: workflowEdges,
  loops = [],
  onNodeClick
}) => {
  const reactFlowInstance = useReactFlow()
  // Helper function to check if a node is in a loop
  const isNodeInLoop = useCallback((nodeId: string) => {
    return loops.some(loop => {
      // Check if node is between start and end of any loop
      const nodesInLoop = getNodesInLoop(workflowNodes, workflowEdges, loop)
      return nodesInLoop.includes(nodeId)
    })
  }, [loops, workflowNodes, workflowEdges])

  // Helper function to get all nodes in a loop
  const getNodesInLoop = (nodes: WorkflowTaskNode[], edges: any[], loop: LoopConfig): string[] => {
    const nodesInLoop: string[] = []
    let currentId = loop.startTaskId
    
    while (currentId) {
      nodesInLoop.push(currentId)
      if (currentId === loop.endTaskId) break
      
      const edge = edges.find(e => e.source === currentId)
      currentId = edge?.target || ''
      
      // Prevent infinite loop
      if (nodesInLoop.length > nodes.length) break
    }
    
    return nodesInLoop
  }

  // Convert workflow nodes to ReactFlow nodes
  const initialNodes: Node[] = workflowNodes.map(node => {
    const inLoop = isNodeInLoop(node.id)
    const isLoopStart = loops.some(loop => loop.startTaskId === node.id)
    const isLoopEnd = loops.some(loop => loop.endTaskId === node.id)
    
    return {
      id: node.id,
      type: 'task',
      position: node.position,
      data: {
        ...node,
        isInLoop: inLoop,
        isLoopStart,
        isLoopEnd,
        onClick: () => onNodeClick?.(node)
      },
    }
  })

  // Helper function to check if an edge is in a loop
  const isEdgeInLoop = useCallback((source: string, target: string) => {
    return loops.some(loop => {
      const nodesInLoop = getNodesInLoop(workflowNodes, workflowEdges, loop)
      // Edge is in loop if both nodes are in the loop
      return nodesInLoop.includes(source) && nodesInLoop.includes(target)
    })
  }, [loops, workflowNodes, workflowEdges])

  // Check if an edge is a loop-back edge
  const isLoopBackEdge = useCallback((source: string, target: string) => {
    return loops.some(loop => 
      source === loop.endTaskId && target === loop.startTaskId
    )
  }, [loops])

  // Convert workflow edges to ReactFlow edges
  const initialEdges: Edge[] = workflowEdges.map(edge => {
    const inLoop = isEdgeInLoop(edge.source, edge.target)
    const isLoopBack = isLoopBackEdge(edge.source, edge.target)
    
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      style: { 
        stroke: inLoop ? '#3b82f6' : 'var(--color-nightshift-light)',
        strokeWidth: inLoop ? 3 : 2,
        strokeDasharray: isLoopBack ? '5,5' : undefined
      },
      animated: edge.source === getCurrentRunningNode()?.id || isLoopBack,
    }
  })

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when workflow nodes or loops change
  React.useEffect(() => {
    setNodes(workflowNodes.map(node => {
      const inLoop = isNodeInLoop(node.id)
      const isLoopStart = loops.some(loop => loop.startTaskId === node.id)
      const isLoopEnd = loops.some(loop => loop.endTaskId === node.id)
      
      return {
        id: node.id,
        type: 'task',
        position: node.position,
        data: {
          ...node,
          isInLoop: inLoop,
          isLoopStart,
          isLoopEnd,
          onClick: () => onNodeClick?.(node)
        },
      }
    }))
    
    // Fit view when nodes change
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2 })
    }, 100)
  }, [workflowNodes, loops, onNodeClick, setNodes, isNodeInLoop, reactFlowInstance])

  // Update edges when workflow edges or loops change
  React.useEffect(() => {
    const processedEdges = workflowEdges.map(edge => {
      const inLoop = isEdgeInLoop(edge.source, edge.target)
      const isLoopBack = isLoopBackEdge(edge.source, edge.target)
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'default',
        style: { 
          stroke: inLoop ? '#3b82f6' : '#6b7280',
          strokeWidth: inLoop ? 3 : 2,
          strokeDasharray: isLoopBack ? '5,5' : undefined,
          opacity: 0.8
        },
        animated: edge.source === getCurrentRunningNode()?.id || isLoopBack,
      }
    })
    
    // Add loop-back edges for accepted loops
    const loopBackEdges = loops
      .filter(loop => loop.currentAttempt !== undefined && loop.currentAttempt !== null)
      .map(loop => ({
        id: `loopback-${loop.id}`,
        source: loop.endTaskId,
        target: loop.startTaskId,
        type: 'default',
        style: {
          stroke: '#f59e0b',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          opacity: 0.6
        },
        animated: true,
        label: `Loop (${loop.currentAttempt || 0}/${loop.maxAttempts || '∞'})`,
        labelStyle: { fill: '#f59e0b', fontSize: 12 },
        labelBgStyle: { fill: '#1a1a1a' }
      }))
    
    setEdges([...processedEdges, ...loopBackEdges])
  }, [workflowEdges, loops, setEdges, isEdgeInLoop, isLoopBackEdge])

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
        <Controls />
        <Background 
          color="var(--color-nightshift-light)" 
          gap={20} 
          size={1}
        />
        <MiniMap 
          pannable={true}
          zoomable={true}
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

export const WorkflowDAG: React.FC<WorkflowDAGProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowDAGInner {...props} />
    </ReactFlowProvider>
  )
}
