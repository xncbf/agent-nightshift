import React, { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

export const LiveOutput: React.FC = () => {
  const { jobs, activeJobId } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJob?.logs])

  if (!activeJob) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-lg">No output yet</p>
        <p className="text-sm mt-2">Logs will appear here when a job is running</p>
      </div>
    )
  }

  const formatLog = (log: string) => {
    // Detect different log types and format accordingly
    if (log.startsWith('>')) {
      return <span style={{ color: '#60a5fa' }}>{log}</span>
    } else if (log.startsWith('✓')) {
      return <span style={{ color: 'var(--color-nightshift-success)' }}>{log}</span>
    } else if (log.startsWith('✗') || log.includes('Error')) {
      return <span style={{ color: 'var(--color-nightshift-error)' }}>{log}</span>
    } else if (log.startsWith('⚠')) {
      return <span style={{ color: 'var(--color-nightshift-warning)' }}>{log}</span>
    }
    return log
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Live Output</h2>
        <div className="flex items-center gap-2">
          {activeJob.status === 'running' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-nightshift-success)' }} />
              <span className="text-sm text-gray-400">Live</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-lg p-4 overflow-auto font-mono text-sm" style={{ backgroundColor: 'var(--color-nightshift-darker)' }}>
        {activeJob.logs.map((log, index) => (
          <div key={index} className="mb-1">
            <span className="text-gray-500 mr-2">
              [{new Date().toLocaleTimeString()}]
            </span>
            {formatLog(log)}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Job #{activeJob.id.slice(-6)}</span>
        <span>{activeJob.logs.length} lines</span>
      </div>
    </div>
  )
}