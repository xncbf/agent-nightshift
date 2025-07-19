import React, { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { FileText, Activity, Terminal, AlertCircle, CheckCircle } from 'lucide-react'

export const ExecutionLogs: React.FC = () => {
  const { jobs, activeJobId } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const logsEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeJob?.logs])
  
  const getLogIcon = (log: string) => {
    if (log.includes('❌') || log.includes('Error') || log.includes('Failed')) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    if (log.includes('✅') || log.includes('Success') || log.includes('Completed')) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    if (log.includes('🚀') || log.includes('Starting')) {
      return <Activity className="w-4 h-4 text-blue-500" />
    }
    if (log.includes('🔍') || log.includes('Claude CLI')) {
      return <Terminal className="w-4 h-4 text-purple-500" />
    }
    return <FileText className="w-4 h-4 text-gray-400" />
  }
  
  const formatLogMessage = (log: string) => {
    // Remove emoji prefixes for cleaner display
    return log.replace(/^[^\s]+\s/, '')
  }
  
  const getLogTime = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Terminal className="w-6 h-6" style={{ color: 'var(--color-nightshift-accent)' }} />
          Execution Logs
        </h2>
        {activeJob && (
          <span className="text-sm px-3 py-1 rounded-full" style={{ 
            backgroundColor: 'var(--color-nightshift-light)',
            color: 'var(--color-nightshift-accent)'
          }}>
            Job: {activeJob.id.slice(0, 8)}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto rounded-lg p-4" style={{ 
        backgroundColor: 'var(--color-nightshift-darker)',
        border: '1px solid var(--color-nightshift-light)'
      }}>
        {!activeJob ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Terminal className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No active job selected</p>
              <p className="text-sm mt-2">Submit a PRD to start execution</p>
            </div>
          </div>
        ) : activeJob.logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-30 animate-pulse" />
              <p>Waiting for logs...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 font-mono text-sm">
            {activeJob.logs.map((log, index) => (
              <div key={index} className="flex items-start gap-3 py-1">
                <span className="text-gray-500 text-xs mt-0.5 min-w-[70px]">
                  {getLogTime()}
                </span>
                {getLogIcon(log)}
                <span className="flex-1 break-words" style={{ color: 'var(--color-nightshift-text)' }}>
                  {formatLogMessage(log)}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
      
      {activeJob && activeJob.status === 'running' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
          <div className="animate-pulse w-2 h-2 rounded-full bg-green-500" />
          <span>Claude Code is executing tasks...</span>
        </div>
      )}
    </div>
  )
}