import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { Send, Plus, X, AlertCircle } from 'lucide-react'

export const PromptsEditor: React.FC = () => {
  const { isSubmitting, setIsSubmitting, addJob, isAIConfigured, aiProvider, jobs, currentPRD, setCurrentPRD, createManualPlan } = useStore()
  const [content, setContent] = useState(currentPRD)
  
  const planningJob = jobs.find(job => job.status === 'planning')
  const isPlanning = !!planningJob
  
  const handleSubmit = async () => {
    if (!content.trim()) return
    
    if (!isAIConfigured) {
      const providerName = aiProvider === 'openai' ? 'OpenAI API key' : 'Claude API key'
      alert(`Please configure ${providerName} first!`)
      return
    }
    
    await addJob(content.trim())
    // Don't clear content so user can see what they submitted
  }

  const handleManualPlan = async () => {
    if (!content.trim()) return
    
    await createManualPlan(content.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">🎯 Prompts</h2>
        <p className="text-sm text-gray-400">
          Enter one or more prompts. You can:
        </p>
        <ul className="text-sm text-gray-400 ml-4 mt-1">
          <li>• Write a single task</li>
          <li>• Paste multiple tasks (one per line)</li>
          <li>• Use numbered lists (1. task one, 2. task two)</li>
          <li>• Use bullet points (- task one, - task two)</li>
        </ul>
        <p className="text-sm text-gray-500 mt-2">
          AI will analyze and optimize the execution order.
        </p>
      </div>

      {aiProvider === 'openai' && !isAIConfigured && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'var(--color-nightshift-warning)', opacity: 0.8 }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">OpenAI API Key Required</p>
            <p className="text-sm">Click the "Set API Key" button in the header to configure your OpenAI API key.</p>
          </div>
        </div>
      )}


      {isPlanning && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'var(--color-nightshift-warning)', opacity: 0.8 }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Plan Generation in Progress</p>
            <p className="text-sm">Currently generating workflow plan. Click "Stop & Create New Plan" to cancel and start a new plan generation.</p>
          </div>
        </div>
      )}
      
      <div className="flex-1 mb-4">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setCurrentPRD(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompts here...&#10;&#10;Examples:&#10;• Create a React component for user authentication&#10;• Set up a REST API with Express&#10;• Add unit tests for all components&#10;&#10;Or just paste a numbered list:&#10;1. Build a landing page&#10;2. Add contact form&#10;3. Deploy to Vercel"
          disabled={isSubmitting}
          className="w-full h-full p-4 rounded-lg resize-none transition-all duration-200 font-mono text-sm"
          style={{
            backgroundColor: 'var(--color-nightshift-darker)',
            border: '2px solid var(--color-nightshift-accent)',
            outline: 'none'
          }}
        />
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !isAIConfigured || !content.trim()}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? 'Analyzing Prompts...' : 
           isPlanning ? 'Stop & Create New Plan' : 
           'Create Plan'}
        </button>
        <button
          onClick={handleManualPlan}
          disabled={isSubmitting || !content.trim()}
          className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-nightshift-light)',
            border: '1px solid var(--color-nightshift-accent)',
            color: 'white'
          }}
          title="Create a manual workflow plan that you can edit"
        >
          <Plus className="w-4 h-4" />
          Manual Plan
        </button>
      </div>
      <div className="text-sm text-gray-500 text-center mt-2">
        Press {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Enter for AI plan • Manual plan lets you create and edit tasks yourself
      </div>
    </div>
  )
}
