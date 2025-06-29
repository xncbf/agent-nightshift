export interface ElectronAPI {
  // Job management
  submitPRD: (prd: string) => Promise<{ success: boolean; jobId?: string; error?: string }>
  getJobStatus: (jobId: string) => Promise<{
    status: string
    progress: number
    currentTask: string
    logs: string[]
  }>
  pauseJob: (jobId: string) => Promise<{ success: boolean; error?: string }>
  resumeJob: (jobId: string) => Promise<{ success: boolean; error?: string }>
  stopJob: (jobId: string) => Promise<{ success: boolean; error?: string }>
  executeWorkflow: (jobId: string, prd: string) => Promise<{ success: boolean; error?: string }>
  executeClaude: (prompt: string) => Promise<{ success: boolean; output?: string; error?: string }>
  
  // Event listeners
  onJobUpdate: (callback: (event: any, data: any) => void) => () => void
  onLogUpdate: (callback: (event: any, data: any) => void) => () => void
  
  // File system
  selectDirectory: () => Promise<{ filePaths: string[]; canceled: boolean }>
  
  // Terminal
  createTerminal: (workDirectory: string, terminalId?: string) => Promise<{ success: boolean; error?: string }>
  sendTerminalInput: (data: string, terminalId?: string) => Promise<void>
  resizeTerminal: (cols: number, rows: number, terminalId?: string) => Promise<void>
  onTerminalData: (callback: (event: any, data: { terminalId: string; data: string }) => void) => () => void
  
  // AI Provider management
  getAIProviders: () => Promise<Array<{
    id: string
    name: string
    version: string
    capabilities: string[]
  }>>
  getCurrentProvider: () => Promise<string>
  setAIProvider: (providerId: string) => Promise<{ success: boolean; error?: string }>
  checkProviderAvailability: () => Promise<Record<string, boolean>>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}