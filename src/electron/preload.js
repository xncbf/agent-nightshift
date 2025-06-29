const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Job management
  submitPRD: (prd) => ipcRenderer.invoke('submit-prd', prd),
  getJobStatus: (jobId) => ipcRenderer.invoke('get-job-status', jobId),
  pauseJob: (jobId) => ipcRenderer.invoke('pause-job', jobId),
  resumeJob: (jobId) => ipcRenderer.invoke('resume-job', jobId),
  stopJob: (jobId) => ipcRenderer.invoke('stop-job', jobId),
  executeWorkflow: (jobId, prd) => ipcRenderer.invoke('execute-workflow', jobId, prd),
  executeClaude: (prompt) => ipcRenderer.invoke('execute-claude', prompt),
  
  // Event listeners
  onJobUpdate: (callback) => {
    ipcRenderer.on('job-update', callback)
    return () => ipcRenderer.removeListener('job-update', callback)
  },
  onLogUpdate: (callback) => {
    ipcRenderer.on('job-log-update', callback)
    return () => ipcRenderer.removeListener('job-log-update', callback)
  },
  
  // File system
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Terminal
  createTerminal: (workDirectory, terminalId) => ipcRenderer.invoke('create-terminal', workDirectory, terminalId),
  sendTerminalInput: (data, terminalId) => ipcRenderer.invoke('terminal-input', data, terminalId),
  resizeTerminal: (cols, rows, terminalId) => ipcRenderer.invoke('terminal-resize', cols, rows, terminalId),
  onTerminalData: (callback) => {
    ipcRenderer.on('terminal-data', callback)
    return () => ipcRenderer.removeListener('terminal-data', callback)
  },
  
  // AI Provider management
  getAIProviders: () => ipcRenderer.invoke('get-ai-providers'),
  getCurrentProvider: () => ipcRenderer.invoke('get-current-provider'),
  setAIProvider: (providerId) => ipcRenderer.invoke('set-ai-provider', providerId),
  checkProviderAvailability: () => ipcRenderer.invoke('check-provider-availability')
})