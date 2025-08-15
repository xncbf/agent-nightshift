import React, { useState, useRef } from 'react'
import { useStore } from '../store/useStore'
import { Send, Plus, AlertCircle, Upload, GitBranch, Layers, ChevronLeft } from 'lucide-react'

export const PromptsEditor: React.FC = () => {
  const { isSubmitting, setIsSubmitting, addJob, jobs, currentPRD, setCurrentPRD, createManualPlan } = useStore()
  const [content, setContent] = useState(currentPRD)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const planningJob = jobs.find(job => job.status === 'planning')
  const isPlanning = !!planningJob
  
  const handleSubmit = async () => {
    if (!content.trim()) return
    
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

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const fileContent = event.target?.result as string
      if (fileContent) {
        setContent(fileContent)
        setCurrentPRD(fileContent)
      }
    }
    reader.readAsText(file)
  }

  const insertMarker = (type: 'parallel' | 'parallel-group' | 'end' | 'end-group') => {
    if (!textareaRef.current) return
    
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentContent = content
    
    let markerText = ''
    switch (type) {
      case 'parallel':
        markerText = '\n\n===parallel===\n'
        break
      case 'parallel-group':
        markerText = '\n\n===parallel-group===\n\n  Task 1: \n  Task 2: \n\n  Task 3: \n  Task 4: \n\n===end-group===\n'
        break
      case 'end':
        markerText = '\n===end===\n\n'
        break
      case 'end-group':
        markerText = '\n===end-group===\n\n'
        break
    }
    
    const newContent = currentContent.slice(0, start) + markerText + currentContent.slice(end)
    setContent(newContent)
    setCurrentPRD(newContent)
    
    // Focus back and set cursor position
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + markerText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
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
          <li>• <strong>Separate tasks with double newlines</strong> for large prompts</li>
        </ul>
        <p className="text-sm text-gray-500 mt-2">
          Tasks will be arranged sequentially by default. Use markers for parallel execution.
        </p>
      </div>


      {isPlanning && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: 'var(--color-nightshift-warning)', opacity: 0.8 }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Plan Generation in Progress</p>
            <p className="text-sm">Currently generating workflow plan. Click "Stop & Create New Plan" to cancel and start a new plan generation.</p>
          </div>
        </div>
      )}
      
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Workflow structure:</span>
        <button
          onClick={() => insertMarker('parallel')}
          className="px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors hover:bg-gray-700"
          style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
          title="Tasks run simultaneously"
        >
          <GitBranch className="w-3 h-3" />
          Parallel
        </button>
        <button
          onClick={() => insertMarker('parallel-group')}
          className="px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors hover:bg-gray-700"
          style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
          title="Multiple sequential groups running in parallel"
        >
          <Layers className="w-3 h-3" />
          Parallel Groups
        </button>
        <button
          onClick={() => insertMarker('end')}
          className="px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors hover:bg-gray-700"
          style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}
          title="End current section"
        >
          <ChevronLeft className="w-3 h-3" />
          End Section
        </button>
      </div>
      
      <div className="flex-1 mb-4">
        <div className="relative h-full">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setCurrentPRD(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompts here...&#10;&#10;Examples:&#10;• Create a React component for user authentication&#10;• Set up a REST API with Express&#10;• Add unit tests for all components&#10;&#10;Or numbered list:&#10;1. Build a landing page&#10;2. Add contact form&#10;3. Deploy to Vercel&#10;&#10;📝 For large prompts, separate tasks with double newlines:&#10;&#10;Task 1: Setup project&#10;Create React app with TypeScript...&#10;&#10;Task 2: Build authentication&#10;Implement login/logout system...&#10;&#10;💡 Use the upload button for very large files."
            disabled={isSubmitting}
            className="w-full h-full p-4 rounded-lg resize-none transition-all duration-200 font-mono text-sm"
            style={{
              backgroundColor: 'var(--color-nightshift-darker)',
              border: '2px solid var(--color-nightshift-accent)',
              outline: 'none'
            }}
          />
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <button
              onClick={handleFileUpload}
              className="p-1 rounded hover:bg-gray-700 transition-colors"
              title="Upload text file"
            >
              <Upload className="w-4 h-4 text-gray-400" />
            </button>
            <div className="text-xs text-gray-500">
              {content.length.toLocaleString()} chars
              {content.length > 50000 && (
                <span className="ml-1 text-orange-400">
                  (chunked)
                </span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.text"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
          className="flex-1 btn-primary flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? 'Creating Plan...' : 
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
        Press {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to create plan • Both buttons create plans without AI
      </div>
    </div>
  )
}
