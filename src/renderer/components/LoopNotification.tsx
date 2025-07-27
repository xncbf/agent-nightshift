import { useState, useEffect } from 'react'
import { LoopConfig, TaskNode } from '../types/workflow'
import { X, Check, Settings } from 'lucide-react'

interface LoopNotificationProps {
  loops: LoopConfig[]
  tasks: TaskNode[]
  onAccept: (loop: LoopConfig) => void
  onReject: (loopId: string) => void
  onModify: (loop: LoopConfig) => void
}

export function LoopNotification({ loops, tasks, onAccept, onReject, onModify }: LoopNotificationProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const currentLoop = loops[currentIndex]

  useEffect(() => {
    if (loops.length > 0 && currentIndex < loops.length) {
      setIsVisible(true)
      setIsExiting(false)
    }
  }, [loops.length, currentIndex])

  if (!currentLoop || loops.length === 0) return null

  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    return task?.title || taskId
  }

  const handleAccept = () => {
    setIsExiting(true)
    setTimeout(() => {
      onAccept(currentLoop)
      moveToNext()
    }, 300)
  }

  const handleReject = () => {
    setIsExiting(true)
    setTimeout(() => {
      onReject(currentLoop.id)
      moveToNext()
    }, 300)
  }

  const handleModify = () => {
    onModify(currentLoop)
    // Don't auto-close when modifying
  }

  const moveToNext = () => {
    if (currentIndex < loops.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsVisible(false)
      setTimeout(() => {
        setIsVisible(true)
        setIsExiting(false)
      }, 100)
    } else {
      setIsVisible(false)
    }
  }

  return (
    <div 
      className={`fixed bottom-4 right-4 max-w-sm bg-gray-900 border border-blue-600/50 rounded-lg shadow-2xl transition-all duration-300 z-50 ${
        isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
      }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h4 className="font-semibold text-sm">Loop Detected</h4>
            <span className="text-xs text-gray-400">
              ({currentIndex + 1}/{loops.length})
            </span>
          </div>
          <button
            onClick={handleReject}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1">Would you like to create a loop for:</p>
          <div className="bg-gray-800/50 rounded p-2">
            <p className="text-sm font-medium text-white truncate">
              {getTaskTitle(currentLoop.startTaskId)}
            </p>
            <p className="text-xs text-gray-400 my-1">↓</p>
            <p className="text-sm font-medium text-white truncate">
              {getTaskTitle(currentLoop.endTaskId)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={handleModify}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="h-1 bg-gray-800">
        <div 
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / loops.length) * 100}%` }}
        />
      </div>
    </div>
  )
}