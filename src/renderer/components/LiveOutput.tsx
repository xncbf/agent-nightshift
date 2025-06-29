import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { ChevronDown, ChevronRight, Terminal, Copy, Download } from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: Date
  type: 'system' | 'claude' | 'error' | 'success' | 'command'
  content: string
  taskId?: string
  isLong?: boolean
}

export const LiveOutput: React.FC = () => {
  const { jobs, activeJobId } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  
  // Fixed base timestamp to prevent regeneration on re-renders
  const baseTimestampRef = useRef<number | null>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logEntries])

  // Reset base timestamp when job changes
  useEffect(() => {
    baseTimestampRef.current = null
    setExpandedLogs(new Set())
    setLogEntries([])
  }, [activeJobId])

  // Parse logs when activeJob.logs changes
  useEffect(() => {
    if (!activeJob?.logs) {
      setLogEntries([])
      return
    }
    
    // Initialize base timestamp only once per job
    if (baseTimestampRef.current === null) {
      baseTimestampRef.current = Date.now() - (activeJob.logs.length * 1000)
    }
    
    const baseTime = new Date(baseTimestampRef.current)
    
    const entries = activeJob.logs.map((log, index) => {
      const id = `log-${index}`
      const isLong = log.length > 60 // Increased to 60 characters
      
      let type: LogEntry['type'] = 'system'
      if (log.includes('Claude:') || log.includes('🤖')) {
        type = 'claude'
      } else if (log.includes('Error') || log.startsWith('✗')) {
        type = 'error'
      } else if (log.startsWith('✓')) {
        type = 'success'
      } else if (log.startsWith('>') || log.includes('$') || log.includes('💻')) {
        type = 'command'
      }

      return {
        id,
        timestamp: new Date(baseTime.getTime() + (index * 1000)),
        type,
        content: log,
        isLong
      }
    })
    
    setLogEntries(entries)
    
    // Debug logging - separate from React lifecycle
    console.log('=== LiveOutput Debug ===')
    console.log('Total logs:', entries.length)
    entries.forEach((log, idx) => {
      console.log(`Log ${idx}: isLong=${log.isLong}, length=${log.content.length}`)
      console.log(`  Full content: "${log.content}"`)
    })
    const longLogs = entries.filter(log => log.isLong)
    if (longLogs.length > 0) {
      console.log(`\n🔍 LONG LOGS FOUND: ${longLogs.length} logs over 100 characters`)
      longLogs.forEach((log, idx) => {
        console.log(`\n📝 Long log ${idx}:`)
        console.log(`   ID: ${log.id}`)
        console.log(`   Length: ${log.content.length} characters`)
        console.log(`   Type: ${log.type}`)
        console.log(`   Full content: "${log.content}"`)
      })
    } else {
      console.log('ℹ️ No long logs found (all logs are under 100 characters)')
    }
  }, [activeJob?.logs])

  const toggleLogExpansion = (logId: string) => {
    console.log(`Toggling expansion for log ${logId}. Currently expanded:`, Array.from(expandedLogs))
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
      console.log(`Collapsing log ${logId}`)
    } else {
      newExpanded.add(logId)
      console.log(`Expanding log ${logId}`)
    }
    setExpandedLogs(newExpanded)
    console.log(`New expanded set:`, Array.from(newExpanded))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const exportLogs = () => {
    if (!activeJob) return
    const logsText = activeJob.logs.join('\n')
    const blob = new Blob([logsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-nightshift-logs-${activeJob.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getLogTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'claude':
        return '🤖'
      case 'error':
        return '❌'
      case 'success':
        return '✅'
      case 'command':
        return '💻'
      default:
        return '📝'
    }
  }

  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'claude':
        return 'var(--color-nightshift-accent)'
      case 'error':
        return 'var(--color-nightshift-error)'
      case 'success':
        return 'var(--color-nightshift-success)'
      case 'command':
        return '#60a5fa'
      default:
        return '#9ca3af'
    }
  }

  const formatLogContent = (log: LogEntry) => {
    const isExpanded = expandedLogs.has(log.id)
    console.log(`formatLogContent for ${log.id}: isLong=${log.isLong}, isExpanded=${isExpanded}, length=${log.content.length}`)
    
    if (!log.isLong || isExpanded) {
      console.log(`  -> Showing full content (${log.content.length} chars)`)
      return log.content
    }
    console.log(`  -> Showing truncated content (60 chars + ...)`)
    return log.content.substring(0, 60) + '...'
  }

  if (!activeJob) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <Terminal className="w-16 h-16 mb-4" />
        <p className="text-lg">No output yet</p>
        <p className="text-sm mt-2">Claude Code output will appear here when a job is running</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Live Output</h2>
        </div>
        <div className="flex items-center gap-2">
          {activeJob.logs.length > 0 && (
            <>
              <button
                onClick={exportLogs}
                className="p-2 rounded-md transition-colors border border-gray-600 hover:border-blue-500 hover:bg-blue-500/10"
                title="Export logs"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}
          {activeJob.status === 'running' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-nightshift-success)' }} />
              <span className="text-sm text-gray-400">Live</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-lg p-4 overflow-auto font-mono text-sm pr-4" 
           style={{ 
             backgroundColor: 'var(--color-nightshift-darker)',
             border: '1px solid #6b7280'
           }}>
        {logEntries.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Waiting for Claude Code output...</p>
          </div>
        ) : (
          logEntries.map((log) => (
            <div key={log.id} className="mb-3 border-l-2 pl-3 py-1" 
                 style={{ borderColor: getLogTypeColor(log.type) }}>
              <div className="flex items-start gap-2">
                <span className="text-xs">
                  {getLogTypeIcon(log.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded text-white" 
                          style={{ backgroundColor: getLogTypeColor(log.type) }}>
                      {log.type}
                    </span>
                    {log.isLong && (
                      <button
                        onClick={() => toggleLogExpansion(log.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                        title={`Log length: ${log.content.length} chars`}
                      >
                        {expandedLogs.has(log.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {expandedLogs.has(log.id) ? 'Collapse' : 'Expand'} ({log.content.length})
                      </button>
                    )}
                    <button
                      onClick={() => copyToClipboard(log.content)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-opacity"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="group relative">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed" 
                         style={{ color: getLogTypeColor(log.type) }}>
                      {formatLogContent(log)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Job #{activeJob.id.slice(-6)}</span>
        <div className="flex items-center gap-4">
          <span>{activeJob.logs.length} entries</span>
          {activeJob.currentTask && (
            <span className="text-blue-400">Current: {activeJob.currentTask}</span>
          )}
        </div>
      </div>
    </div>
  )
}
