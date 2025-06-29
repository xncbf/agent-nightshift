import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useStore } from '../store/useStore'

export const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { workDirectory } = useStore()

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    // Create terminal instance
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
      convertEol: true,
      allowProposedApi: true
    })

    // Add addons
    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon
    term.loadAddon(fitAddon)
    
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(webLinksAddon)

    // Open terminal in the DOM
    term.open(terminalRef.current)
    fitAddon.fit()

    // Store reference
    xtermRef.current = term

    // Write welcome message
    term.writeln('🌙 Agent Nightshift Terminal')
    term.writeln(`📂 Working Directory: ${workDirectory}`)
    term.writeln('─'.repeat(60))
    term.writeln('')

    // Create actual terminal
    window.electronAPI.createTerminal(workDirectory).then((result) => {
      if (!result.success) {
        term.writeln(`❌ Failed to create terminal: ${result.error}`)
      }
    })

    // Set up IPC listeners for terminal output
    const handleTerminalData = (event: any, data: string) => {
      term.write(data)
    }

    const unsubscribe = window.electronAPI.onTerminalData(handleTerminalData)

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize)
      unsubscribe()
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [workDirectory])

  // Handle terminal input
  useEffect(() => {
    if (!xtermRef.current) return

    const term = xtermRef.current
    const disposable = term.onData((data: string) => {
      // Send input to the backend
      window.electronAPI.sendTerminalInput(data)
    })

    return () => {
      disposable.dispose()
    }
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Terminal Output</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear()
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
      
      <div 
        ref={terminalRef}
        className="flex-1 rounded-lg overflow-hidden"
        style={{
          backgroundColor: '#0a0a0f',
          border: '1px solid var(--color-nightshift-light)'
        }}
      />
    </div>
  )
}