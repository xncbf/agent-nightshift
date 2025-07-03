import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useStore } from '../store/useStore'
import { Terminal, X, Maximize2, Minimize2 } from 'lucide-react'

interface TerminalTab {
  id: string
  title: string
  terminal: XTerm
  fitAddon: FitAddon
  element?: HTMLDivElement
}

export const MultiTerminal: React.FC = () => {
  const { jobs, activeJobId, workDirectory } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const [terminals, setTerminals] = useState<Map<string, TerminalTab>>(new Map())
  const [activeTerminalId, setActiveTerminalId] = useState<string>('main')
  const [isMaximized, setIsMaximized] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Create main terminal on mount
  useEffect(() => {
    createTerminal('main', '🌙 Main Terminal', true)
    
    // Listen for terminal switch events
    const handleSwitchTerminal = (event: any) => {
      const { terminalId } = event.detail
      if (terminals.has(terminalId)) {
        setActiveTerminalId(terminalId)
      } else {
        // Create terminal for this task if it doesn't exist
        const task = activeJob?.workflowPlan?.nodes.find(n => n.id === terminalId)
        if (task) {
          createTerminal(terminalId, task.title)
          setActiveTerminalId(terminalId)
        }
      }
    }
    
    window.addEventListener('switchTerminal', handleSwitchTerminal)
    
    return () => {
      window.removeEventListener('switchTerminal', handleSwitchTerminal)
      // Cleanup all terminals
      terminals.forEach(tab => {
        ;(tab.terminal as any)._cleanup?.()
        tab.terminal.dispose()
      })
    }
  }, [activeJob?.workflowPlan])

  // Create terminals for parallel tasks when workflow starts
  useEffect(() => {
    if (!activeJob?.workflowPlan || activeJob.status !== 'running') return

    const parallelTasks = activeJob.workflowPlan.nodes.filter(node => {
      if (node.type !== 'task') return false
      // Check if multiple tasks have the same dependencies (parallel execution)
      const sameDeps = activeJob.workflowPlan!.nodes.filter(n => 
        n.type === 'task' && 
        JSON.stringify(n.dependencies) === JSON.stringify(node.dependencies)
      )
      return sameDeps.length > 1
    })

    // Create terminal for each parallel task
    parallelTasks.forEach(task => {
      if (!terminals.has(task.id)) {
        createTerminal(task.id, task.title)
      }
    })
  }, [activeJob?.workflowPlan, activeJob?.status])

  const createTerminal = async (id: string, title: string, isMain = false) => {
    const term = new XTerm({
      theme: {
        background: '#0a0a0f',
        foreground: '#f3f4f6',
        cursor: '#f3f4f6',
        cursorAccent: '#0a0a0f',
        selection: 'rgba(74, 95, 216, 0.3)',
        black: '#1f2937',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f3f4f6',
        brightBlack: '#6b7280',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      convertEol: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(webLinksAddon)

    // Welcome message
    term.writeln(`📂 ${title}`)
    term.writeln(`Working Directory: ${workDirectory}`)
    term.writeln('─'.repeat(60))
    term.writeln('')

    // Create actual terminal process
    const result = await window.electronAPI.createTerminal(workDirectory, id)
    if (!result.success) {
      term.writeln(`❌ Failed to create terminal: ${result.error}`)
    }

    // Handle terminal data
    const handleData = (_event: any, data: { terminalId: string; data: string }) => {
      if (data.terminalId === id) {
        term.write(data.data)
      }
    }
    const unsubscribe = window.electronAPI.onTerminalData(handleData)

    // Handle input
    const inputDisposable = term.onData((data: string) => {
      console.log(`Terminal ${id} input:`, data)
      window.electronAPI.sendTerminalInput(data, id)
    })

    const newTab: TerminalTab = {
      id,
      title,
      terminal: term,
      fitAddon,
      element: undefined
    }

    setTerminals(prev => new Map(prev).set(id, newTab))

    // Store cleanup function
    ;(term as any)._cleanup = () => {
      unsubscribe()
      inputDisposable.dispose()
    }
    
    console.log(`Terminal ${id} created successfully`)
  }

  const closeTerminal = (id: string) => {
    if (id === 'main') return // Can't close main terminal

    const tab = terminals.get(id)
    if (tab) {
      ;(tab.terminal as any)._cleanup?.()
      tab.terminal.dispose()
      setTerminals(prev => {
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })
      
      if (activeTerminalId === id) {
        setActiveTerminalId('main')
      }
    }
  }

  // Render active terminal
  useEffect(() => {
    const activeTab = terminals.get(activeTerminalId)
    if (activeTab && containerRef.current) {
      // Clear container
      containerRef.current.innerHTML = ''
      
      // Create div for terminal
      const termDiv = document.createElement('div')
      termDiv.style.width = '100%'
      termDiv.style.height = '100%'
      containerRef.current.appendChild(termDiv)
      
      // Open terminal in div (only if not already opened)
      if (!activeTab.element) {
        activeTab.terminal.open(termDiv)
        activeTab.element = termDiv
        activeTab.fitAddon.fit()
        
        // Focus the terminal to enable input
        activeTab.terminal.focus()
      } else {
        // Move existing terminal to new container
        containerRef.current.appendChild(activeTab.element)
        activeTab.fitAddon.fit()
        activeTab.terminal.focus()
      }
      
      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (activeTab.fitAddon) {
          activeTab.fitAddon.fit()
        }
      })
      resizeObserver.observe(containerRef.current)
      
      return () => {
        resizeObserver.disconnect()
      }
    }
  }, [activeTerminalId, terminals])

  return (
    <div className={`h-full flex flex-col ${isMaximized ? 'fixed inset-0 z-50' : ''}`}
         style={isMaximized ? { backgroundColor: 'var(--color-nightshift-dark)' } : {}}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Terminal Output</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded transition-colors"
            style={{
              backgroundColor: 'var(--color-nightshift-darker)',
              color: '#9ca3af'
            }}
            title={isMaximized ? 'Minimize' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              const activeTab = terminals.get(activeTerminalId)
              if (activeTab) {
                activeTab.terminal.clear()
              }
            }}
            className="px-3 py-1 rounded-md text-sm"
            style={{
              backgroundColor: 'var(--color-nightshift-darker)',
              color: '#9ca3af'
            }}
          >
            Clear
          </button>
        </div>
      </div>
      
      {/* Terminal Tabs */}
      <div className="flex items-center gap-1 mb-2 overflow-x-auto">
        {Array.from(terminals.entries()).map(([id, tab]) => (
          <div
            key={id}
            className={`flex items-center gap-2 px-3 py-1 rounded-t-md cursor-pointer transition-colors ${
              activeTerminalId === id ? 'bg-opacity-100' : 'bg-opacity-50 hover:bg-opacity-75'
            }`}
            style={{
              backgroundColor: activeTerminalId === id 
                ? 'var(--color-nightshift-light)' 
                : 'var(--color-nightshift-darker)',
              borderBottom: activeTerminalId === id ? '2px solid var(--color-nightshift-accent)' : 'none'
            }}
            onClick={() => setActiveTerminalId(id)}
          >
            <Terminal className="w-3 h-3" />
            <span className="text-sm whitespace-nowrap">
              {tab.title}
              {/* Show parallel indicator for tasks with same dependencies */}
              {activeJob?.workflowPlan && (() => {
                const currentTask = activeJob.workflowPlan.nodes.find(n => n.id === id)
                if (currentTask && currentTask.type === 'task') {
                  const parallelTasks = activeJob.workflowPlan.nodes.filter(n => 
                    n.type === 'task' && 
                    n.id !== id &&
                    JSON.stringify(n.dependencies) === JSON.stringify(currentTask.dependencies)
                  )
                  if (parallelTasks.length > 0) {
                    return <span className="ml-1 text-xs text-yellow-400">⚡</span>
                  }
                }
                return null
              })()}
            </span>
            {id !== 'main' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(id)
                }}
                className="ml-1 p-0.5 rounded hover:bg-red-500 hover:bg-opacity-20"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      
      {/* Terminal Container */}
      <div 
        ref={containerRef}
        className="flex-1 rounded-lg overflow-hidden"
        style={{
          backgroundColor: '#0a0a0f',
          border: '1px solid var(--color-nightshift-light)'
        }}
      />
    </div>
  )
}