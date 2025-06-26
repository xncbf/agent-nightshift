export {}

declare global {
  interface Window {
    electronAPI: {
      submitPRD: (prd: string) => Promise<{ success: boolean; jobId: string }>
      getJobStatus: (jobId: string) => Promise<{
        status: string
        progress: number
        currentTask: string
        logs: string[]
      }>
      onJobUpdate: (callback: (event: any, data: any) => void) => () => void
      onLogUpdate: (callback: (event: any, data: any) => void) => () => void
    }
  }
}