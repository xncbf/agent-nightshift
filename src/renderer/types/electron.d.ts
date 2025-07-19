export interface ElectronAPI {
  // Job management
  submitPRD: (prd: string) => Promise<{ success: boolean; jobId: string }>
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
  
  // Claude direct execution
  executeClaudeCommand: (options: {
    claudePath: string
    args: string[]
    workDirectory: string
    timeout?: number
    env?: Record<string, string>
  }) => Promise<{
    success: boolean
    output?: string
    error?: string
    hasSuccess?: boolean
    hasFailed?: boolean
  }>
  
  // File operations
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  
  // Claude environment validation
  validateClaudeEnvironment: () => Promise<{
    isValid: boolean
    claudePath: string | null
    mcpServers: string[]
    errors: string[]
    warnings: string[]
  }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}