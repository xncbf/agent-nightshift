import React, { useEffect, useState } from 'react'
import { PromptsEditor } from './components/PromptsEditor'
import { WorkflowStatus } from './components/WorkflowStatus'
import { ExecutionLogs } from './components/ExecutionLogs'
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


  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-nightshift-dark)' }}>
      {/* Title Bar */}
      <header className="h-12 flex items-center justify-between px-4 drag-region" style={{ backgroundColor: 'var(--color-nightshift-darker)', borderBottom: '1px solid var(--color-nightshift-light)' }}>
        <div className="flex items-center gap-3 ml-16">
          <span className="text-2xl">🌙</span>
          <h1 className="text-lg font-semibold">Agent Nightshift </h1>
        </div>
        
        <div className="flex items-center gap-4 text-sm no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-small'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
          onClick={() => {
            // Always focus when clicking anywhere in the panel
            if (focusedPanel !== 'prd') {
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
            'panel-small'
          }`}
          style={{ borderRight: '1px solid var(--color-nightshift-light)' }}
          onClick={() => {
            // Always focus when clicking anywhere in the panel
            if (focusedPanel !== 'workflow') {
              setFocusedPanel('workflow')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <WorkflowStatus />
          </div>
        </section>

        {/* Execution Logs Panel */}
        <section 
          className={`layout-panel p-6 cursor-pointer transition-all duration-300 ${
            focusedPanel === 'output' ? 'panel-maximized' :
            layoutMode === 'editing' ? 'panel-medium-small' :
            layoutMode === 'planning' ? 'panel-medium-small' :
            'panel-medium'
          }`}
          onClick={() => {
            // Always focus when clicking anywhere in the panel
            if (focusedPanel !== 'output') {
              setFocusedPanel('output')
            }
          }}
        >
          <div className="layout-panel-content h-full">
            <ExecutionLogs />
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
