import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { Play, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'

interface TaskNodeData {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  type: 'task' | 'start' | 'end' | 'decision'
  duration?: number
  onClick: () => void
}

interface TaskNodeProps {
  data: TaskNodeData
}

export const TaskNode: React.FC<TaskNodeProps> = ({ data }) => {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running':
        return <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-nightshift-success)' }} />
      case 'failed':
        return <XCircle className="w-4 h-4" style={{ color: 'var(--color-nightshift-error)' }} />
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />
      default:
        return <Play className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'border-yellow-400 shadow-yellow-400/20'
      case 'completed':
        return 'border-green-500 shadow-green-500/20'
      case 'failed':
        return 'border-red-500 shadow-red-500/20'
      case 'pending':
        return 'border-gray-600'
      default:
        return 'border-gray-600'
    }
  }

  const getNodeStyle = () => {
    const baseStyle = {
      backgroundColor: 'var(--color-nightshift-darker)',
      color: '#f3f4f6',
      minWidth: '180px',
      padding: '12px',
      borderRadius: '8px',
      border: '2px solid',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }

    if (data.status === 'running') {
      return {
        ...baseStyle,
        borderColor: 'var(--color-nightshift-warning)',
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
        backgroundColor: 'var(--color-nightshift-light)',
      }
    } else if (data.status === 'completed') {
      return {
        ...baseStyle,
        borderColor: 'var(--color-nightshift-success)',
        boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)',
      }
    } else if (data.status === 'failed') {
      return {
        ...baseStyle,
        borderColor: 'var(--color-nightshift-error)',
        boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)',
      }
    }

    return {
      ...baseStyle,
      borderColor: 'var(--color-nightshift-light)',
    }
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ backgroundColor: 'var(--color-nightshift-accent)' }} />
      
      <div 
        style={getNodeStyle()}
        onClick={data.onClick}
        onMouseEnter={(e) => {
          if (data.status === 'pending') {
            e.currentTarget.style.borderColor = 'var(--color-nightshift-accent)'
          }
        }}
        onMouseLeave={(e) => {
          if (data.status === 'pending') {
            e.currentTarget.style.borderColor = 'var(--color-nightshift-light)'
          }
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{data.title}</span>
        </div>
        
        <div className="text-xs text-gray-400 mb-2">
          {data.description}
        </div>
        
        {data.duration && (
          <div className="text-xs text-gray-500">
            ~{data.duration}min
          </div>
        )}
        
        {data.status === 'running' && (
          <div className="mt-2">
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div className="bg-yellow-400 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ backgroundColor: 'var(--color-nightshift-accent)' }} />
    </>
  )
}