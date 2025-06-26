import React from 'react'
import { useStore } from '../store/useStore'

export const Footer: React.FC = () => {
  const { jobs, activeJobId, layoutMode } = useStore()
  const activeJob = jobs.find(job => job.id === activeJobId)
  
  const runningJobs = jobs.filter(job => job.status === 'running').length
  const completedJobs = jobs.filter(job => job.status === 'completed').length
  
  const getStatusIndicator = () => {
    if (runningJobs > 0) {
      return { icon: '🟢', text: 'Active' }
    } else if (activeJob) {
      return { icon: '🟡', text: 'Idle' }
    }
    return { icon: '⚫', text: 'Offline' }
  }
  
  const status = getStatusIndicator()
  
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
        <span>Claude Code Nightshift v1.0.0</span>
      </div>
    </footer>
  )
}