const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  submitPRD: (prd) => ipcRenderer.invoke('submit-prd', prd),
  getJobStatus: (jobId) => ipcRenderer.invoke('get-job-status', jobId),
  onJobUpdate: (callback) => {
    ipcRenderer.on('job-update', callback)
    return () => ipcRenderer.removeListener('job-update', callback)
  },
  onLogUpdate: (callback) => {
    ipcRenderer.on('log-update', callback)
    return () => ipcRenderer.removeListener('log-update', callback)
  }
})