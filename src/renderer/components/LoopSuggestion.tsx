import React from 'react'
import { LoopConfig, TaskNode } from '../types/workflow'

interface LoopSuggestionProps {
  loops: LoopConfig[]
  tasks: TaskNode[]
  onAccept: (loop: LoopConfig) => void
  onReject: (loopId: string) => void
  onModify: (loop: LoopConfig) => void
}

export function LoopSuggestion({ loops, tasks, onAccept, onReject, onModify }: LoopSuggestionProps) {
  if (loops.length === 0) return null

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    return task?.title || taskId
  }

  return (
    <div className="bg-blue-900/20 border border-blue-700/50 rounded p-2 mb-2 text-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1">
          <span className="text-sm">✨</span>
          <h3 className="font-semibold text-sm">Loop Suggestions</h3>
        </div>
        <button
          onClick={() => loops.forEach(loop => onReject(loop.id))}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Dismiss all
        </button>
      </div>
      
      <div className="space-y-2">
        {loops.map((loop, index) => (
          <div key={`${loop.id}-${index}`} className="bg-gray-800/50 rounded p-2">
            <p className="text-xs text-gray-400 mb-1">
              Loop detected:
            </p>
            <p className="text-xs font-medium mb-2 truncate">
              {getTaskTitle(loop.startTaskId)} → {getTaskTitle(loop.endTaskId)}
            </p>
            
            <div className="flex gap-1">
              <button
                onClick={() => onAccept(loop)}
                className="flex-1 bg-green-600/80 hover:bg-green-600 text-white text-xs px-2 py-0.5 rounded transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onModify(loop)}
                className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-2 py-0.5 rounded transition-colors"
              >
                Config
              </button>
              <button
                onClick={() => onReject(loop.id)}
                className="flex-1 bg-gray-600/80 hover:bg-gray-600 text-white text-xs px-2 py-0.5 rounded transition-colors"
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}