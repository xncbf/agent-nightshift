import React, { useEffect, useState } from 'react'
import { PromptsEditor } from './components/PromptsEditor'
import { WorkflowStatus } from './components/WorkflowStatus'
import { MultiTerminal } from './components/MultiTerminal'
import { Footer } from './components/Footer'
import { LayoutTransition } from './components/LayoutTransition'
import { useStore } from './store/useStore'
import { openaiService } from './services/openaiService'
import { claudeApiService } from './services/claudeApiService'

function App() {
  const { 
    updateJob, 
    layoutMode, 
    focusedPanel, 
    setFocusedPanel, 
    openaiApiKey, 
    setOpenaiApiKey, 
    isOpenaiConfigured,
    claudeApiKey,
    setClaudeApiKey,
    isClaudeConfigured,
    aiProvider,
    setAiProvider,
    openaiModel,
    setOpenaiModel,
    claudeModel,
    setClaudeModel
  } = useStore()
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [tempApiKey, setTempApiKey] = useState('')
  const [showProviderDropdown, setShowProviderDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)

  useEffect(() => {
    // Initialize OpenAI service with saved key and model
    if (openaiApiKey) {
      openaiService.setApiKey(openaiApiKey)
    }
    openaiService.setModel(openaiModel)
    
    // Initialize Claude API service with saved key and model
    if (claudeApiKey) {
      claudeApiService.setApiKey(claudeApiKey)
    }
    claudeApiService.setModel(claudeModel)
  }, [openaiApiKey, openaiModel, claudeApiKey, claudeModel])

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = () => {
      setShowProviderDropdown(false)
      setShowModelDropdown(false)
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    // Set up IPC listeners for job updates
    const unsubscribeJobUpdate = window.electronAPI.onJobUpdate((event, data) => {
      console.log('Job update received:', data)
      updateJob(data.jobId, data.updates)
    })

    const unsubscribeLogUpdate = window.electronAPI.onLogUpdate((event, data) => {
      console.log('Log update received:', data)
      updateJob(data.jobId, {
        logs: data.logs
      })
    })

    // Cleanup listeners on unmount
    return () => {
      unsubscribeJobUpdate()
      unsubscribeLogUpdate()
    }
  }, [updateJob])

  // Re-enable simulation to test long logs
  useEffect(() => {
    console.log('Simulation re-enabled for testing long logs')
    return () => {}
  }, [])
  
  // SIMULATION CODE - RE-ENABLED FOR TESTING
  useEffect(() => {
    
    const interval = setInterval(() => {
      const { jobs, updateJob } = useStore.getState()
      const runningJob = jobs.find(job => job.status === 'running') // Only process running jobs, not paused
      
      // Skip simulation if real Claude Code execution has started (check for specific log patterns)
      if (runningJob && runningJob.logs.some(log => log.includes('claude: command not found') || log.includes('Claude Code execution'))) {
        console.log('Real Claude Code execution detected, stopping simulation')
        return
      }
      
      if (runningJob && runningJob.workflowPlan) {
        const { workflowPlan } = runningJob
        const taskNodes = workflowPlan.nodes.filter(n => n.type === 'task')
        const completedTasks = taskNodes.filter(n => n.status === 'completed')
        const runningTask = taskNodes.find(n => n.status === 'running')
        const pendingTasks = taskNodes.filter(n => n.status === 'pending')
        
        // If no task is running but there are pending tasks, start the next one
        if (!runningTask && pendingTasks.length > 0) {
          const nextTask = pendingTasks[0]
          const updatedNodes = workflowPlan.nodes.map(n =>
            n.id === nextTask.id ? { ...n, status: 'running' as const } : n
          )
          
          const newLogs = [
            `💻 Executing: ${nextTask.title}`,
            `🤖 Claude: Starting work on "${nextTask.title}". I'll now analyze the task requirements and determine the best approach to implement this functionality. Let me break this down into smaller steps and execute them systematically.`,
            `📝 Reading detailed task instructions: ${nextTask.description || 'No description available'}`,
            `💻 Running preliminary environment checks and dependency analysis...`
          ]
          
          console.log('App: Adding new logs with lengths:', newLogs.map(log => log.length))
          
          updateJob(runningJob.id, {
            workflowPlan: { ...workflowPlan, nodes: updatedNodes },
            currentTask: `Executing: ${nextTask.title}`,
            logs: [...runningJob.logs, ...newLogs]
          })
        }
        
        // If there's a running task, potentially complete it
        if (runningTask && Math.random() > 0.7) {
          const updatedNodes = workflowPlan.nodes.map(n =>
            n.id === runningTask.id ? { ...n, status: 'completed' as const } : n
          )
          
          const newCompletedCount = completedTasks.length + 1
          const totalTasks = taskNodes.length
          const progress = Math.min(Math.round((newCompletedCount / totalTasks) * 100), 100)
          
          const mockClaudeOutput = [
            `🤖 Claude: Executing task "${runningTask.title}" - I'll start by analyzing the task requirements and breaking this down into smaller actionable steps. Let me first examine the current project structure and understand what needs to be implemented.`,
            `💻 $ npm install --save-dev typescript @types/node @types/react @types/react-dom eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier`,
            `📝 Installing dependencies... This will set up TypeScript support, type definitions for React and Node.js, ESLint for code quality, and Prettier for code formatting. These tools are essential for maintaining code quality in a TypeScript React project.`,
            `✅ Successfully installed TypeScript dependencies - All packages have been installed successfully and are now available in the project`,
            `💻 $ npx tsc --init --target ES2020 --lib DOM,DOM.Iterable,ES6 --allowJs --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --strict --forceConsistentCasingInFileNames --moduleResolution node --resolveJsonModule --isolatedModules --noEmit --jsx react-jsx`,
            `📝 Initializing TypeScript configuration with React-optimized settings... This configuration enables strict type checking, modern JavaScript features, and React JSX transform. The settings ensure compatibility with React and provide excellent developer experience with IntelliSense and error detection.`,
            `🤖 Claude: Task completed successfully! I've set up a comprehensive TypeScript configuration that includes: 1) TypeScript compiler with React support, 2) ESLint for code quality analysis, 3) Prettier for consistent code formatting, 4) Type definitions for React and Node.js. Files created: tsconfig.json with optimized React settings, package.json updated with all necessary development dependencies. The project is now ready for TypeScript development with full tooling support.`,
            `✅ Completed ${runningTask.title} - All configuration files are in place and the development environment is properly configured`
          ]
          
          console.log('App: Adding completion logs with lengths:', mockClaudeOutput.map(log => log.length))
          
          updateJob(runningJob.id, {
            workflowPlan: { ...workflowPlan, nodes: updatedNodes },
            progress,
            currentTask: newCompletedCount >= totalTasks ? 'All tasks completed!' : 'Preparing next task...',
            logs: [...runningJob.logs, ...mockClaudeOutput],
            status: newCompletedCount >= totalTasks ? 'completed' : 'running'
          })
        }
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-nightshift-dark)' }}>
      {/* Title Bar */}
      <header className="h-12 flex items-center justify-between px-4 drag-region" style={{ backgroundColor: 'var(--color-nightshift-darker)', borderBottom: '1px solid var(--color-nightshift-light)' }}>
        <div className="flex items-center gap-3 ml-16">
          <span className="text-2xl">🌙</span>
          <h1 className="text-lg font-semibold">Agent Nightshift </h1>
        </div>
        
        <div className="flex items-center gap-4 text-sm no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* AI Provider Selection */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">AI:</span>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProviderDropdown(!showProviderDropdown)
                }}
                className="px-2 py-1 rounded-md text-sm font-medium cursor-pointer flex items-center gap-1"
                style={{
                  backgroundColor: 'var(--color-nightshift-darker)',
                  border: '1px solid var(--color-nightshift-accent)',
                  color: 'white',
                  outline: 'none'
                }}
              >
                {aiProvider === 'openai' ? '🤖 OpenAI' : '🤖 Claude API'}
                <span style={{ transform: showProviderDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
              </button>
              
              {showProviderDropdown && (
                <div 
                  className="absolute top-full left-0 mt-1 min-w-full rounded-md shadow-lg z-50"
                  style={{
                    backgroundColor: 'var(--color-nightshift-darker)',
                    border: '1px solid var(--color-nightshift-accent)'
                  }}
                >
                  <button
                    onClick={() => {
                      setAiProvider('openai')
                      setShowProviderDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity"
                    style={{ color: 'white' }}
                  >
                    🤖 OpenAI
                  </button>
                  <button
                    onClick={() => {
                      setAiProvider('claude')
                      setShowProviderDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity"
                    style={{ color: 'white' }}
                  >
                    🤖 Claude API
                  </button>
                </div>
              )}
            </div>
            
            {/* OpenAI Model Selection */}
            {aiProvider === 'openai' && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowModelDropdown(!showModelDropdown)
                  }}
                  className="px-2 py-1 rounded-md text-sm font-medium cursor-pointer flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--color-nightshift-darker)',
                    border: '1px solid var(--color-nightshift-accent)',
                    color: 'white',
                    outline: 'none'
                  }}
                >
                  {openaiModel === 'gpt-4o-mini' ? 'GPT-4o Mini' : 
                   openaiModel === 'gpt-4o' ? 'GPT-4o' : 'GPT-3.5 Turbo'}
                  <span style={{ transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                </button>
                
                {showModelDropdown && (
                  <div 
                    className="absolute top-full left-0 mt-1 min-w-full rounded-md shadow-lg z-50"
                    style={{
                      backgroundColor: 'var(--color-nightshift-darker)',
                      border: '1px solid var(--color-nightshift-accent)'
                    }}
                  >
                    <button
                      onClick={() => {
                        setOpenaiModel('gpt-4o-mini')
                        setShowModelDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: 'white' }}
                    >
                      GPT-4o Mini
                    </button>
                    <button
                      onClick={() => {
                        setOpenaiModel('gpt-4o')
                        setShowModelDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: 'white' }}
                    >
                      GPT-4o
                    </button>
                    <button
                      onClick={() => {
                        setOpenaiModel('gpt-3.5-turbo')
                        setShowModelDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: 'white' }}
                    >
                      GPT-3.5 Turbo
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Claude Model Selection */}
            {aiProvider === 'claude' && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowModelDropdown(!showModelDropdown)
                  }}
                  className="px-2 py-1 rounded-md text-sm font-medium cursor-pointer flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--color-nightshift-darker)',
                    border: '1px solid var(--color-nightshift-accent)',
                    color: 'white',
                    outline: 'none'
                  }}
                >
                  {claudeModel === 'claude-sonnet-4-0' ? 'Claude Sonnet 4' : 'Claude Opus 4'}
                  <span style={{ transform: showModelDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                </button>
                
                {showModelDropdown && (
                  <div 
                    className="absolute top-full left-0 mt-1 min-w-full rounded-md shadow-lg z-50"
                    style={{
                      backgroundColor: 'var(--color-nightshift-darker)',
                      border: '1px solid var(--color-nightshift-accent)'
                    }}
                  >
                    <button
                      onClick={() => {
                        setClaudeModel('claude-sonnet-4-0')
                        setShowModelDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: 'white' }}
                    >
                      Claude Sonnet 4
                    </button>
                    <button
                      onClick={() => {
                        setClaudeModel('claude-opus-4-0')
                        setShowModelDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity whitespace-nowrap"
                      style={{ color: 'white' }}
                    >
                      Claude Opus 4
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Configuration Status */}
          {aiProvider === 'openai' && (
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="px-3 py-1 rounded-md font-medium transition-all duration-300"
              style={{ 
                backgroundColor: isOpenaiConfigured ? 'var(--color-nightshift-success)' : 'var(--color-nightshift-warning)',
                color: 'white'
              }}
            >
              {isOpenaiConfigured ? '🔑 API Configured' : '⚠️ Set API Key'}
            </button>
          )}
          
          {aiProvider === 'claude' && (
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="px-3 py-1 rounded-md font-medium transition-all duration-300"
              style={{ 
                backgroundColor: isClaudeConfigured ? 'var(--color-nightshift-success)' : 'var(--color-nightshift-warning)',
                color: 'white'
              }}
            >
              {isClaudeConfigured ? '🔑 API Configured' : '⚠️ Set API Key'}
            </button>
          )}
          
          <span className="text-gray-400">Mode:</span>
          <span 
            className="px-2 py-1 rounded-md font-medium transition-all duration-300"
            style={{ 
              backgroundColor: layoutMode === 'editing' ? 'var(--color-nightshift-accent)' :
                              layoutMode === 'planning' ? 'var(--color-nightshift-warning)' :
                              'var(--color-nightshift-success)',
              color: 'white'
            }}
          >
            {layoutMode === 'editing' ? '✏️ Editing' :
             layoutMode === 'planning' ? '🎯 Planning' :
             '⚡ Executing'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* PRD Editor Panel */}
        <section 
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'prd' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-large' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-small'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
          onClick={(e) => {
            // Focus when clicking on the panel, but not on buttons
            const target = e.target as HTMLElement
            if (!target.closest('button, a, [role="button"]')) {
              setFocusedPanel('prd')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <PromptsEditor />
          </div>
        </section>

        {/* Workflow Status Panel */}
        <section 
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'workflow' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-full' :
            'panel-medium'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
          onClick={(e) => {
            // Focus when clicking on the panel, but not on buttons
            const target = e.target as HTMLElement
            if (!target.closest('button, a, [role="button"]')) {
              setFocusedPanel('workflow')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <WorkflowStatus />
          </div>
        </section>

        {/* Live Output Panel */}
        <section 
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'output' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-medium'
          }`}
          onClick={(e) => {
            // Focus when clicking on the panel, but not on buttons
            const target = e.target as HTMLElement
            if (!target.closest('button, a, [role="button"]')) {
              setFocusedPanel('output')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <MultiTerminal />
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
      
      {/* Layout Transition Indicator */}
      <LayoutTransition />
      
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="rounded-lg p-6 max-w-md w-full" style={{ backgroundColor: 'var(--color-nightshift-darker)', border: '1px solid var(--color-nightshift-accent)' }}>
            <h2 className="text-xl font-semibold mb-4">
              🔑 Configure {aiProvider === 'openai' ? 'OpenAI' : 'Claude'} API Key
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Enter your {aiProvider === 'openai' ? 'OpenAI' : 'Claude'} API key to enable AI-powered workflow generation.
              Your key will be stored locally in your browser.
            </p>
            <input
              type="password"
              value={tempApiKey || (aiProvider === 'openai' ? openaiApiKey : claudeApiKey)}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder={aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
              className="w-full px-3 py-2 rounded-md mb-4"
              style={{
                backgroundColor: 'var(--color-nightshift-light)',
                border: '1px solid var(--color-nightshift-accent)'
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setTempApiKey('')
                  setShowApiKeyModal(false)
                }}
                className="px-4 py-2 rounded-md"
                style={{ backgroundColor: 'var(--color-nightshift-light)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const key = tempApiKey || (aiProvider === 'openai' ? openaiApiKey : claudeApiKey)
                  if (aiProvider === 'openai') {
                    setOpenaiApiKey(key)
                    openaiService.setApiKey(key)
                  } else {
                    setClaudeApiKey(key)
                    claudeApiService.setApiKey(key)
                  }
                  setTempApiKey('')
                  setShowApiKeyModal(false)
                }}
                className="px-4 py-2 rounded-md"
                style={{ backgroundColor: 'var(--color-nightshift-accent)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
