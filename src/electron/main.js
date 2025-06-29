const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { AIProviderManager } = require('./aiProviderManager')

let mainWindow
const aiManager = new AIProviderManager()
const activeJobs = new Map()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1300,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../../public/icon.png')
  })

  // Development vs Production
  const isDev = process.env.NODE_ENV !== 'production'
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Set up AI provider listeners
function setupProviderListeners() {
  const provider = aiManager.getProvider()
  
  provider.on('output', ({ jobId, data }) => {
    const job = activeJobs.get(jobId)
    if (job) {
      job.logs.push(data)
      mainWindow?.webContents.send('job-log-update', { jobId, logs: job.logs })
    }
  })

  provider.on('task-update', ({ jobId, taskId, status, message }) => {
  const job = activeJobs.get(jobId)
  if (job) {
    // Update workflow node status
    if (job.workflowPlan) {
      const node = job.workflowPlan.nodes.find(n => n.id === taskId)
      if (node) {
        node.status = status === 'completed' ? 'completed' : 'running'
      }
    }
    
    job.currentTask = message || job.currentTask
    mainWindow?.webContents.send('job-update', { 
      jobId, 
      updates: {
        currentTask: job.currentTask,
        workflowPlan: job.workflowPlan
      }
    })
  }
  })

  provider.on('complete', ({ jobId, code }) => {
  const job = activeJobs.get(jobId)
  if (job) {
    job.status = code === 0 ? 'completed' : 'failed'
    job.progress = 100
    mainWindow?.webContents.send('job-update', { 
      jobId, 
      updates: {
        status: job.status,
        progress: job.progress
      }
    })
  }
  })

  provider.on('error', ({ jobId, error }) => {
  const job = activeJobs.get(jobId)  
  if (job) {
    job.logs.push(`ERROR: ${error}`)
    mainWindow?.webContents.send('job-log-update', { jobId, logs: job.logs })
  }
  })
}

// Initialize provider listeners
setupProviderListeners()

// IPC Handlers for AI interactions
ipcMain.handle('submit-prd', async (event, prd) => {
  const jobId = Date.now().toString()
  
  // Initialize job tracking for workflow plan generation only
  activeJobs.set(jobId, {
    id: jobId,
    status: 'planning',
    progress: 0,
    currentTask: 'Generating workflow plan...',
    logs: ['📝 Job created', '🧠 Analyzing PRD and generating workflow plan...'],
    workflowPlan: null
  })
  
  console.log('Main: Created job for workflow planning:', jobId)
  
  // Don't execute yet, just return job ID for workflow planning
  return { success: true, jobId }
})

ipcMain.handle('get-job-status', async (event, jobId) => {
  const job = activeJobs.get(jobId)
  if (!job) {
    return {
      status: 'unknown',
      progress: 0,
      currentTask: 'Job not found',
      logs: []
    }
  }
  
  return {
    status: job.status,
    progress: job.progress,
    currentTask: job.currentTask,
    logs: job.logs
  }
})

// New handlers for job control
ipcMain.handle('pause-job', async (event, jobId) => {
  return aiManager.pauseJob(jobId)
})

ipcMain.handle('resume-job', async (event, jobId) => {
  return aiManager.resumeJob(jobId)
})

ipcMain.handle('stop-job', async (event, jobId) => {
  const result = aiManager.stopJob(jobId)
  if (result.success) {
    const job = activeJobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.currentTask = 'Stopped by user'
    }
  }
  return result
})

// AI Provider management handlers
ipcMain.handle('get-ai-providers', async () => {
  return aiManager.getAvailableProviders()
})

ipcMain.handle('get-current-provider', async () => {
  return aiManager.getCurrentProviderId()
})

ipcMain.handle('set-ai-provider', async (event, providerId) => {
  try {
    aiManager.setProvider(providerId)
    setupProviderListeners() // Re-setup listeners for new provider
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('check-provider-availability', async () => {
  return aiManager.checkProviderAvailability()
})

// Execute workflow with Claude Code CLI
ipcMain.handle('execute-workflow', async (event, jobId, prd) => {
  console.log('Main: Executing workflow for job:', jobId)
  
  const job = activeJobs.get(jobId)
  if (!job) {
    return { success: false, error: 'Job not found' }
  }
  
  // Start real Claude Code execution
  const result = await aiManager.executePlan(jobId, prd)
  
  if (result.success) {
    job.status = 'running'
    job.currentTask = 'Claude Code execution started'
    job.logs.push('🚀 Starting Claude Code CLI execution...')
    
    // Notify renderer about the start
    mainWindow?.webContents.send('job-update', { 
      jobId, 
      updates: {
        status: job.status,
        currentTask: job.currentTask
      }
    })
    mainWindow?.webContents.send('job-log-update', { jobId, logs: job.logs })
  }
  
  return result
})

// Execute Claude CLI command
ipcMain.handle('execute-claude', async (event, prompt) => {
  console.log('Main: Executing Claude CLI with prompt length:', prompt.length)
  
  const { spawn } = require('child_process')
  const path = require('path')
  const os = require('os')
  
  try {
    // Find Claude CLI path
    const homedir = os.homedir()
    const possiblePaths = [
      path.join(homedir, '.claude', 'local', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      'claude'  // fallback to PATH
    ]
    
    let claudePath = 'claude'
    for (const p of possiblePaths) {
      try {
        if (require('fs').existsSync(p)) {
          claudePath = p
          break
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    return new Promise((resolve) => {
      const claudeProcess = spawn(claudePath, ['-p', prompt], {
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let output = ''
      let error = ''
      
      claudeProcess.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      claudeProcess.stderr.on('data', (data) => {
        error += data.toString()
      })
      
      claudeProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: output.trim() })
        } else {
          resolve({ success: false, error: error || `Claude CLI exited with code ${code}` })
        }
      })
      
      claudeProcess.on('error', (err) => {
        resolve({ success: false, error: `Failed to execute Claude CLI: ${err.message}` })
      })
      
      // Set timeout for long-running commands
      setTimeout(() => {
        claudeProcess.kill()
        resolve({ success: false, error: 'Claude CLI execution timeout (600s)' })
      }, 600000)
    })
    
  } catch (error) {
    return { success: false, error: error.message }
  }
})
