import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { Send, Plus, X, AlertCircle } from 'lucide-react'

export const PromptsEditor: React.FC = () => {
  const { isSubmitting, setIsSubmitting, addJob, isAIConfigured, aiProvider } = useStore()
  const [content, setContent] = useState('')
  
  const handleSubmit = async () => {
    if (!content.trim()) return
    
    if (!isAIConfigured) {
      const providerName = aiProvider === 'openai' ? 'OpenAI API key' : 'Claude Code'
      alert(`Please configure ${providerName} first!`)
      return
    }
    
    await addJob(content.trim())
    setContent('')
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

      {aiProvider === 'claude-code' && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'var(--color-nightshift-accent)', opacity: 0.8 }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Claude Code Performance Notice</p>
            <p className="text-sm">Claude Code provides high-quality analysis but may take longer to process compared to OpenAI API. Please be patient during plan generation.</p>
          </div>
        </div>
      )}
      
      <div className="flex-1 mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your prompts here...\n\nExamples:\n• Create a React component for user authentication\n• Set up a REST API with Express\n• Add unit tests for all components\n\nOr just paste a numbered list:\n1. Build a landing page\n2. Add contact form\n3. Deploy to Vercel"
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
          {isSubmitting ? 'Analyzing Prompts...' : 'Create Plan'}
        </button>
        <div className="text-sm text-gray-500 flex items-center">
          Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
        </div>
      </div>
    </div>
  )
}