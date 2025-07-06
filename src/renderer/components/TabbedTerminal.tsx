import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useStore } from '../store/useStore'
import { Terminal, X, Maximize2, Minimize2 } from 'lucide-react'

interface TerminalTab {
  id: string
  title: string
  isParallel?: boolean
}

export const TabbedTerminal: React.FC = () => {
  const { jobs, activeJobId, workDirectory, layoutMode, focusedPanel, setFocusedPanel } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const [terminals, setTerminals] = useState<TerminalTab[]>([{ id: 'main', title: '🌙 Main Terminal' }])
  const [activeTerminalId, setActiveTerminalId] = useState<string>('main')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement>(null)
  const terminalInstances = useRef<Map<string, {
    element: HTMLDivElement
    xterm: XTerm
    fitAddon: FitAddon
    cleanup: () => void
  }>>(new Map())

  // Initialize main terminal
  useEffect(() => {
    // Wait for component to mount
    const initTimer = setTimeout(() => {
      if (terminalContainerRef.current) {
        initializeTerminal('main')
      }
    }, 100)
    
    // Listen for terminal switch events
    const handleSwitchTerminal = (event: any) => {
      const { terminalId } = event.detail
      switchToTerminal(terminalId)
    }
    
    window.addEventListener('switchTerminal', handleSwitchTerminal)
    
    return () => {
      clearTimeout(initTimer)
      window.removeEventListener('switchTerminal', handleSwitchTerminal)
      // Cleanup all terminal instances
      terminalInstances.current.forEach((instance) => {
        try {
          instance.cleanup()
          instance.xterm.dispose()
        } catch (error) {
          console.error('Error cleaning up terminal:', error)
        }
      })
      terminalInstances.current.clear()
    }
  }, [])

  // Add terminals for parallel tasks
  useEffect(() => {
    if (!activeJob?.workflowPlan || activeJob.status !== 'running') return

    const taskNodes = activeJob.workflowPlan.nodes.filter(n => n.type === 'task')
    const newTerminals: TerminalTab[] = [{ id: 'main', title: '🌙 Main Terminal' }]

    // Find parallel tasks (tasks with same dependencies)
    const parallelGroups = new Map<string, any[]>()
    taskNodes.forEach(task => {
      const depKey = JSON.stringify(task.dependencies.sort())
      if (!parallelGroups.has(depKey)) {
        parallelGroups.set(depKey, [])
      }
      parallelGroups.get(depKey)!.push(task)
    })

    // Add terminals for tasks that have parallel siblings
    parallelGroups.forEach(tasks => {
      if (tasks.length > 1) {
        tasks.forEach(task => {
          newTerminals.push({
            id: task.id,
            title: task.title,
            isParallel: true
          })
        })
      }
    })

    setTerminals(newTerminals)
    
    // Initialize new terminals that don't exist yet
    newTerminals.forEach(terminal => {
      if (!terminalInstances.current.has(terminal.id)) {
        setTimeout(() => initializeTerminal(terminal.id), 100)
      }
    })
  }, [activeJob?.workflowPlan, activeJob?.status])

  // Handle layout changes to resize terminals
  useEffect(() => {
    const resizeTerminals = () => {
      setTimeout(() => {
        terminalInstances.current.forEach((instance, terminalId) => {
          try {
            instance.fitAddon.fit()
            // Re-focus active terminal after layout change
            if (terminalId === activeTerminalId) {
              instance.xterm.focus()
              console.log(`Terminal ${terminalId} re-focused after layout change`)
            }
          } catch (error) {
            console.error('Error resizing terminal on layout change:', error)
          }
        })
      }, 300) // Wait for CSS transition to complete
    }
    
    resizeTerminals()
  }, [layoutMode, focusedPanel, activeTerminalId])

  // Use ResizeObserver for more accurate resize detection
  useEffect(() => {
    if (!terminalContainerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        terminalInstances.current.forEach((instance) => {
          try {
            instance.fitAddon.fit()
          } catch (error) {
            console.error('Error resizing terminal with ResizeObserver:', error)
          }
        })
      }, 100)
    })

    resizeObserver.observe(terminalContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Handle fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      // Resize terminals when entering fullscreen
      setTimeout(() => {
        terminalInstances.current.forEach((instance, terminalId) => {
          try {
            instance.fitAddon.fit()
            const { cols, rows } = instance.xterm
            window.electronAPI.resizeTerminal(cols, rows, terminalId)
          } catch (error) {
            console.error('Error resizing terminal for fullscreen:', error)
          }
        })
      }, 100)

      // ESC key to exit fullscreen
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsFullscreen(false)
        }
      }
      
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  const initializeTerminal = async (terminalId: string) => {
    const currentContainer = isFullscreen ? fullscreenContainerRef.current : terminalContainerRef.current
    if (!currentContainer) return
    
    // Skip if terminal already exists
    if (terminalInstances.current.has(terminalId)) {
      console.log(`Terminal ${terminalId} already exists, skipping initialization`)
      return
    }

    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Create terminal element
    const terminalElement = document.createElement('div')
    terminalElement.style.width = '100%'
    terminalElement.style.height = '100%'
    terminalElement.style.display = terminalId === activeTerminalId ? 'block' : 'none'

    const term = new XTerm({
      theme: {
        background: '#0a0a0f',
        foreground: '#f3f4f6',
        cursor: '#f3f4f6',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(74, 95, 216, 0.3)',
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
      convertEol: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(webLinksAddon)

    // Open terminal
    try {
      currentContainer.appendChild(terminalElement)
      term.open(terminalElement)
      
      // Fit after a small delay to ensure dimensions are available
      setTimeout(() => {
        if (fitAddon && terminalElement) {
          try {
            fitAddon.fit()
            if (terminalId === activeTerminalId) {
              // Ensure terminal gets focus for input
              term.focus()
              console.log(`Terminal ${terminalId} focused and ready for input`)
            }
          } catch (error) {
            console.error('Error fitting terminal:', error)
          }
        }
      }, 100)
    } catch (error) {
      console.error('Error opening terminal:', error)
      return
    }

    // Welcome message
    const terminalTab = terminals.find(t => t.id === terminalId)
    term.writeln(`📂 ${terminalTab?.title || 'Terminal'}`)
    term.writeln(`Working Directory: ${workDirectory}`)
    term.writeln('─'.repeat(60))
    term.writeln('')

    // Create backend terminal
    try {
      const result = await window.electronAPI.createTerminal(workDirectory, terminalId)
      if (!result.success) {
        term.writeln(`❌ Failed to create terminal: ${result.error}`)
      }
    } catch (error) {
      term.writeln(`❌ Terminal creation error: ${error}`)
    }

    // Handle terminal data
    const handleData = (_event: any, data: { terminalId: string; data: string }) => {
      if (data.terminalId === terminalId) {
        term.write(data.data)
      }
    }
    const unsubscribe = window.electronAPI.onTerminalData(handleData)

    // Handle input
    const inputDisposable = term.onData((data: string) => {
      window.electronAPI.sendTerminalInput(data, terminalId)
    })

    // Handle resize
    const handleResize = () => {
      if (fitAddon && terminalElement) {
        try {
          fitAddon.fit()
        } catch (error) {
          console.error('Error during resize:', error)
        }
      }
    }
    window.addEventListener('resize', handleResize)

    // Store cleanup function
    const cleanup = () => {
      unsubscribe()
      inputDisposable.dispose()
      window.removeEventListener('resize', handleResize)
    }
    
    // Store terminal instance
    terminalInstances.current.set(terminalId, {
      element: terminalElement,
      xterm: term,
      fitAddon,
      cleanup
    })
  }

  const switchToTerminal = async (terminalId: string) => {
    if (terminalId === activeTerminalId) return

    // Hide current terminal
    terminalInstances.current.forEach((instance, id) => {
      instance.element.style.display = id === terminalId ? 'block' : 'none'
    })

    setActiveTerminalId(terminalId)
    
    // Initialize terminal if it doesn't exist
    if (!terminalInstances.current.has(terminalId)) {
      await initializeTerminal(terminalId)
    } else {
      // Focus existing terminal
      const instance = terminalInstances.current.get(terminalId)
      if (instance) {
        setTimeout(() => {
          try {
            instance.fitAddon.fit()
            instance.xterm.focus()
            console.log(`Switched to terminal ${terminalId} and focused for input`)
          } catch (error) {
            console.error('Error focusing terminal:', error)
          }
        }, 50)
      }
    }
  }

  // Removed unused addTerminal function

  const removeTerminal = (terminalId: string) => {
    if (terminalId === 'main') return
    
    // Cleanup terminal instance
    const instance = terminalInstances.current.get(terminalId)
    if (instance) {
      try {
        instance.cleanup()
        instance.xterm.dispose()
        instance.element.remove()
        terminalInstances.current.delete(terminalId)
      } catch (error) {
        console.error('Error removing terminal:', error)
      }
    }
    
    setTerminals(prev => prev.filter(t => t.id !== terminalId))
    if (activeTerminalId === terminalId) {
      switchToTerminal('main')
    }
  }


  // Create fullscreen terminal component
  const fullscreenTerminal = isFullscreen ? createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ backgroundColor: 'var(--color-nightshift-dark)' }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Terminal Output - Fullscreen</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded transition-colors hover:bg-opacity-80"
              style={{
                backgroundColor: 'var(--color-nightshift-accent)',
                color: 'white'
              }}
              title="Exit Fullscreen (ESC)"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const instance = terminalInstances.current.get(activeTerminalId)
                if (instance) {
                  instance.xterm.clear()
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
          {terminals.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-1 rounded-t-md cursor-pointer transition-colors ${
                activeTerminalId === tab.id ? 'bg-opacity-100' : 'bg-opacity-50 hover:bg-opacity-75'
              }`}
              style={{
                backgroundColor: activeTerminalId === tab.id 
                  ? 'var(--color-nightshift-light)' 
                  : 'var(--color-nightshift-darker)',
                borderBottom: activeTerminalId === tab.id ? '2px solid var(--color-nightshift-accent)' : 'none'
              }}
              onClick={() => switchToTerminal(tab.id)}
            >
              <Terminal className="w-3 h-3" />
              <span className="text-sm whitespace-nowrap">
                {tab.title}
                {tab.isParallel && <span className="ml-1 text-xs text-yellow-400">⚡</span>}
              </span>
              {tab.id !== 'main' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTerminal(tab.id)
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-red-500 hover:bg-opacity-20"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Terminal Container - Full Screen */}
      <div 
        className="flex-1 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-nightshift-dark)'
        }}
      >
        <div 
          ref={fullscreenContainerRef}
          className="h-full rounded-lg overflow-hidden"
          style={{
            backgroundColor: '#0a0a0f',
            border: '1px solid var(--color-nightshift-light)',
            position: 'relative'
          }}
          onClick={() => {
            const instance = terminalInstances.current.get(activeTerminalId)
            if (instance) {
              instance.xterm.focus()
            }
          }}
        />
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="h-full flex flex-col">
      
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Terminal Output</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              console.log('Setting fullscreen to true')
              setIsFullscreen(true)
            }}
            className="p-1 rounded transition-colors hover:bg-opacity-80"
            style={{
              backgroundColor: 'var(--color-nightshift-darker)',
              color: '#9ca3af'
            }}
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const instance = terminalInstances.current.get(activeTerminalId)
              if (instance) {
                instance.xterm.clear()
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
        {terminals.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-1 rounded-t-md cursor-pointer transition-colors ${
              activeTerminalId === tab.id ? 'bg-opacity-100' : 'bg-opacity-50 hover:bg-opacity-75'
            }`}
            style={{
              backgroundColor: activeTerminalId === tab.id 
                ? 'var(--color-nightshift-light)' 
                : 'var(--color-nightshift-darker)',
              borderBottom: activeTerminalId === tab.id ? '2px solid var(--color-nightshift-accent)' : 'none'
            }}
            onClick={() => switchToTerminal(tab.id)}
          >
            <Terminal className="w-3 h-3" />
            <span className="text-sm whitespace-nowrap">
              {tab.title}
              {tab.isParallel && <span className="ml-1 text-xs text-yellow-400">⚡</span>}
            </span>
            {tab.id !== 'main' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeTerminal(tab.id)
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
        ref={terminalContainerRef}
        className="flex-1 rounded-lg overflow-hidden"
        style={{
          backgroundColor: '#0a0a0f',
          border: '1px solid var(--color-nightshift-light)',
          minHeight: '200px',
          position: 'relative'
        }}
        onClick={() => {
          // Re-focus terminal when container is clicked
          const instance = terminalInstances.current.get(activeTerminalId)
          if (instance) {
            instance.xterm.focus()
            console.log(`Terminal ${activeTerminalId} re-focused via container click`)
          }
        }}
      />
      
      {/* Render fullscreen terminal via portal */}
      {fullscreenTerminal}
    </div>
  )
}