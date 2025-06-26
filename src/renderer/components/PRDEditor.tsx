import React from 'react'
import { useStore } from '../store/useStore'
import { Plus } from 'lucide-react'

export const PRDEditor: React.FC = () => {
  const { currentPRD, setCurrentPRD, addJob, isSubmitting, layoutMode, setLayoutMode } = useStore()

  const handleSubmit = async () => {
    if (currentPRD.trim() && !isSubmitting) {
      await addJob(currentPRD)
    }
  }

  const handleNewPRD = () => {
    setCurrentPRD('')
    setLayoutMode('editing')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">💡 Describe Your Idea</h2>
        <div className="flex items-center gap-2">
          {(layoutMode === 'planning' || layoutMode === 'executing') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNewPRD()
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors btn-secondary"
            >
              <Plus className="w-4 h-4" />
New Plan
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleSubmit()
            }}
            disabled={!currentPRD.trim() || isSubmitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
{isSubmitting ? 'Creating Plan...' : '🎯 Create Plan'}
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col">
        <textarea
          value={currentPRD}
          onChange={(e) => setCurrentPRD(e.target.value)}
          placeholder="# My App Idea

I want to create a React app with:
- User authentication
- Dashboard with charts  
- Dark mode support
- Responsive design
- Real-time notifications
..."
          className="flex-1 w-full p-4 rounded-lg resize-none focus:outline-none font-mono text-sm"
          style={{
            backgroundColor: 'var(--color-nightshift-darker)',
            border: '1px solid var(--color-nightshift-light)',
            color: '#f3f4f6'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--color-nightshift-accent)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--color-nightshift-light)'}
        />
      </div>
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Tip: Describe your idea clearly for better planning results</p>
      </div>
    </div>
  )
}