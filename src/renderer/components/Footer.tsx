import React, { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

interface ClaudeStatus {
  isValid: boolean
  claudePath: string | null
  errors: string[]
  warnings: string[]
}

export const Footer: React.FC = () => {
  const { jobs, activeJobId, layoutMode } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null)
  
  const runningJobs = jobs.filter(job => job.status === 'running').length
  const completedJobs = jobs.filter(job => job.status === 'completed').length
  
  // Check Claude CLI status on mount
  useEffect(() => {
    const checkClaudeStatus = async () => {
      try {
        const result = await window.electronAPI.validateClaudeEnvironment()
        setClaudeStatus(result)
      } catch (error) {
        console.error('Failed to check Claude status:', error)
        setClaudeStatus({
          isValid: false,
          claudePath: null,
          errors: ['Failed to check Claude CLI'],
          warnings: []
        })
      }
    }
    
    checkClaudeStatus()
  }, [])
  
  const getClaudeStatusIndicator = () => {
    if (!claudeStatus) {
      return { icon: '🟡', text: 'Checking...' }
    }
    
    if (!claudeStatus.isValid) {
      return { icon: '🔴', text: 'CLI Error', title: claudeStatus.errors.join('; ') }
    }
    
    if (claudeStatus.warnings.length > 0) {
      return { icon: '🟡', text: 'CLI Warning', title: claudeStatus.warnings.join('; ') }
    }
    
    return { icon: '🟢', text: 'CLI Ready', title: `Claude CLI available at ${claudeStatus.claudePath}` }
  }
  
  const getStatusIndicator = () => {
    if (runningJobs > 0) {
      return { icon: '🟢', text: 'Active' }
    } else if (activeJob) {
      return { icon: '🟡', text: 'Idle' }
    }
    return { icon: '⚫', text: 'Offline' }
  }
  
  const status = getStatusIndicator()
  const claudeStatusInfo = getClaudeStatusIndicator()
  
  // Calculate elapsed time for active job
  const getElapsedTime = () => {
    if (!activeJob || activeJob.status !== 'running') return ''
    
    const elapsed = Date.now() - new Date(activeJob.createdAt).getTime()
    const hours = Math.floor(elapsed / 3600000)
    const minutes = Math.floor((elapsed % 3600000) / 60000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <footer className="h-12 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--color-nightshift-darker)', borderTop: '1px solid var(--color-nightshift-light)' }}>
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span>{status.icon}</span>
          <span>Claude: {status.text}</span>
        </div>
        
        <div className="w-px h-4" style={{ backgroundColor: 'var(--color-nightshift-light)' }} />
        
        <div 
          className="flex items-center gap-2 cursor-help" 
          title={claudeStatusInfo.title}
        >
          <span>{claudeStatusInfo.icon}</span>
          <span>{claudeStatusInfo.text}</span>
        </div>
        
        {runningJobs > 0 && (
          <>
            <div className="w-px h-4" style={{ backgroundColor: 'var(--color-nightshift-light)' }} />
            <span>Tasks: {completedJobs}/{jobs.length}</span>
          </>
        )}
        
        {activeJob && activeJob.status === 'running' && (
          <>
            <div className="w-px h-4" style={{ backgroundColor: 'var(--color-nightshift-light)' }} />
            <span>Time: {getElapsedTime()}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>Mode: {layoutMode}</span>
        <span>Agent Nightshift  v1.0.0</span>
      </div>
    </footer>
  )
}
