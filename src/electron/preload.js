const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Job management
  submitPRD: (prd) => ipcRenderer.invoke('submit-prd', prd),
  registerJob: (jobData) => ipcRenderer.invoke('register-job', jobData),
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
  
  
  // AI Provider management
  getAIProviders: () => ipcRenderer.invoke('get-ai-providers'),
  getCurrentProvider: () => ipcRenderer.invoke('get-current-provider'),
  setAIProvider: (providerId) => ipcRenderer.invoke('set-ai-provider', providerId),
  checkProviderAvailability: () => ipcRenderer.invoke('check-provider-availability'),
  
  // Claude direct execution
  executeClaudeCommand: (options) => ipcRenderer.invoke('execute-claude-command', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  validateClaudeEnvironment: () => ipcRenderer.invoke('validate-claude-environment')
})