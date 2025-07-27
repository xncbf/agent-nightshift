import React from 'react'
import { LoopConfig } from '../types/workflow'

interface LoopConfigModalProps {
  loop: LoopConfig
  taskTitles: { [key: string]: string }
  onSave: (loop: LoopConfig) => void
  onCancel: () => void
}

export function LoopConfigModal({ loop, taskTitles, onSave, onCancel }: LoopConfigModalProps) {
  const [config, setConfig] = React.useState<LoopConfig>(loop)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(config)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-2xl">🔄</span>
          Loop Configuration
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Loop Range:</p>
            <p className="text-white">
              {taskTitles[config.startTaskId]} → {taskTitles[config.endTaskId]}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Termination Condition:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="condition"
                  value="until-success"
                  checked={config.condition === 'until-success'}
                  onChange={(e) => setConfig({ ...config, condition: 'until-success' })}
                  className="text-blue-500"
                />
                <span>Until Success</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="condition"
                  value="max-attempts"
                  checked={config.condition === 'max-attempts'}
                  onChange={(e) => setConfig({ ...config, condition: 'max-attempts' })}
                  className="text-blue-500"
                />
                <span>Maximum Attempts</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="condition"
                  value="time-limit"
                  checked={config.condition === 'time-limit'}
                  onChange={(e) => setConfig({ ...config, condition: 'time-limit' })}
                  className="text-blue-500"
                />
                <span>Time Limit</span>
              </label>
            </div>
          </div>

          {config.condition === 'max-attempts' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Maximum Attempts:
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.maxAttempts || 3}
                onChange={(e) => setConfig({ ...config, maxAttempts: parseInt(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
              />
            </div>
          )}

          {config.condition === 'time-limit' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Time Limit (minutes):
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.timeLimit || 30}
                onChange={(e) => setConfig({ ...config, timeLimit: parseInt(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              On Failure:
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="onFailure"
                  value="continue"
                  checked={config.onFailure === 'continue'}
                  onChange={(e) => setConfig({ ...config, onFailure: 'continue' })}
                  className="text-blue-500"
                />
                <span>Continue to next task</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="onFailure"
                  value="stop"
                  checked={config.onFailure === 'stop'}
                  onChange={(e) => setConfig({ ...config, onFailure: 'stop' })}
                  className="text-blue-500"
                />
                <span>Stop execution</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Save Configuration
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}