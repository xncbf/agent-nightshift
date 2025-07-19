const { app, BrowserWindow, ipcMain, dialog } = require('electron')
// Terminal removed - direct Claude execution only
const path = require('path')
const { spawn, execSync } = require('child_process')
const fs = require('fs').promises
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
  try {
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
  } catch (error) {
    console.log('AI Provider not configured yet:', error.message)
    // This is expected when no provider is set - will be configured later via UI
  }
}

// Initialize provider listeners - moved to after app ready
// setupProviderListeners()

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

// Job registration handler
ipcMain.handle('register-job', async (event, jobData) => {
  console.log('Main: Registering job:', jobData.id)
  activeJobs.set(jobData.id, jobData)
  return { success: true }
})

// New handlers for job control
ipcMain.handle('pause-job', async (event, jobId) => {
  const job = activeJobs.get(jobId)
  if (!job) {
    console.log('Main: Job not found in activeJobs:', jobId)
    console.log('Main: Available jobs:', Array.from(activeJobs.keys()))
    return { success: false, error: 'Job not found' }
  }
  
  // For now, just update job status since we're using direct API calls
  job.status = 'paused'
  job.currentTask = 'Paused by user'
  job.logs.push('⏸️ Execution paused')
  
  mainWindow?.webContents.send('job-update', { 
    jobId, 
    updates: {
      status: job.status,
      currentTask: job.currentTask
    }
  })
  mainWindow?.webContents.send('job-log-update', { jobId, logs: job.logs })
  
  return { success: true }
})

ipcMain.handle('resume-job', async (event, jobId) => {
  const job = activeJobs.get(jobId)
  if (!job) {
    return { success: false, error: 'Job not found' }
  }
  
  // For now, just update job status since we're using direct API calls
  job.status = 'running'
  job.currentTask = 'Resuming execution...'
  job.logs.push('▶️ Execution resumed')
  
  mainWindow?.webContents.send('job-update', { 
    jobId, 
    updates: {
      status: job.status,
      currentTask: job.currentTask
    }
  })
  mainWindow?.webContents.send('job-log-update', { jobId, logs: job.logs })
  
  return { success: true }
})

ipcMain.handle('stop-job', async (event, jobId) => {
  const job = activeJobs.get(jobId)
  if (!job) {
    return { success: false, error: 'Job not found' }
  }
  
  // Update job status
  job.status = 'ready'
  job.progress = 0
  job.currentTask = 'Workflow ready for execution'
  job.logs.push('⏹️ Execution stopped - Ready to restart')
  
  // Reset workflow nodes to pending state
  if (job.workflowPlan) {
    job.workflowPlan.nodes = job.workflowPlan.nodes.map(node => ({
      ...node,
      status: node.type === 'start' ? 'completed' : 'pending'
    }))
  }
  
  mainWindow?.webContents.send('job-update', { 
    jobId, 
    updates: {
      status: job.status,
      progress: job.progress,
      currentTask: job.currentTask,
      workflowPlan: job.workflowPlan
    }
  })
  mainWindow?.webContents.send('job-log-update', { jobId, logs: job.logs })
  
  return { success: true }
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
  let result
  try {
    result = await aiManager.executePlan(jobId, prd)
  } catch (error) {
    // No AI provider configured - this is expected for OpenAI/Claude API usage
    console.log('AI Provider not configured, using direct API instead')
    return { success: false, error: 'Please use OpenAI or Claude API directly' }
  }
  
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
        resolve({ success: false, error: 'Claude CLI execution timeout (1200s)' })
      }, 1200000)
    })
    
  } catch (error) {
    return { success: false, error: error.message }
  }
})


// Select directory dialog
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Work Directory for Claude Code Agent'
    })
    
    return {
      filePaths: result.filePaths,
      canceled: result.canceled
    }
  } catch (error) {
    console.error('Failed to open directory dialog:', error)
    return { filePaths: [], canceled: true }
  }
})


// Terminal functionality removed - using direct Claude execution instead

// Claude direct execution handler
ipcMain.handle('execute-claude-command', async (event, options) => {
  console.log('Main: Executing Claude command directly:', options)
  
  const { claudePath, args, workDirectory, timeout = 300000, env = {} } = options
  
  try {
    return new Promise((resolve) => {
      const claudeProcess = spawn(claudePath, args, {
        cwd: workDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...env
        }
      })
      
      let output = ''
      let error = ''
      
      claudeProcess.stdout.on('data', (data) => {
        output += data.toString()
        console.log(`Claude output: ${data.toString()}`)
      })
      
      claudeProcess.stderr.on('data', (data) => {
        const errorText = data.toString()
        error += errorText
        // Don't log shell snapshot errors
        if (!errorText.includes('shell-snapshots')) {
          console.error(`Claude error: ${errorText}`)
        }
      })
      
      claudeProcess.on('close', (code) => {
        console.log(`Claude process exited with code: ${code}`)
        
        if (code === 0) {
          resolve({ 
            success: true, 
            output: output.trim(),
            hasSuccess: output.includes('###TASK_SUCCESS###'),
            hasFailed: output.includes('###TASK_FAILED###')
          })
        } else {
          resolve({ 
            success: false, 
            error: error || `Claude process exited with code ${code}`,
            output: output.trim()
          })
        }
      })
      
      claudeProcess.on('error', (err) => {
        console.error('Claude process error:', err)
        resolve({ 
          success: false, 
          error: `Failed to execute Claude: ${err.message}`,
          output: output.trim()
        })
      })
      
      // Set timeout
      setTimeout(() => {
        claudeProcess.kill('SIGTERM')
        resolve({ 
          success: false, 
          error: 'Claude execution timeout',
          output: output.trim()
        })
      }, timeout)
    })
    
  } catch (error) {
    console.error('Claude command execution error:', error)
    return { success: false, error: error.message }
  }
})

// File operations for Claude
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8')
    return { success: true }
  } catch (error) {
    console.error('Failed to write file:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    await fs.unlink(filePath)
    return { success: true }
  } catch (error) {
    console.error('Failed to delete file:', error)
    return { success: false, error: error.message }
  }
})

// Claude environment validation
ipcMain.handle('validate-claude-environment', async () => {
  console.log('Main: Validating Claude environment')
  
  const result = {
    isValid: false,
    claudePath: null,
    mcpServers: [],
    errors: [],
    warnings: []
  }
  
  try {
    // 1. Find Claude CLI path
    const claudePath = await findClaudePath()
    if (!claudePath) {
      result.errors.push('Claude CLI not found. Please install Claude Code.')
      return result
    }
    
    result.claudePath = claudePath
    
    // 2. Test Claude CLI execution
    const canExecute = await testClaudeExecution(claudePath)
    if (!canExecute) {
      result.errors.push('Claude CLI found but cannot execute properly.')
      return result
    }
    
    // 3. Get MCP servers
    const mcpServers = await getMCPServers()
    result.mcpServers = mcpServers
    
    if (mcpServers.length === 0) {
      result.warnings.push('No MCP servers configured. Some features may not work.')
    }
    
    // 4. Check for required MCP servers
    const requiredMCPs = ['chatgpt', 'terminal', 'filesystem']
    const missingMCPs = requiredMCPs.filter(mcp => 
      !mcpServers.some(server => server.toLowerCase().includes(mcp))
    )
    
    if (missingMCPs.length > 0) {
      result.warnings.push(`Recommended MCP servers not found: ${missingMCPs.join(', ')}`)
    }
    
    result.isValid = true
    console.log('✅ Claude environment validation successful')
    return result
    
  } catch (error) {
    console.error('❌ Claude environment validation failed:', error)
    result.errors.push(`Validation failed: ${error.message}`)
    return result
  }
})

// Helper function to find Claude CLI path
async function findClaudePath() {
  const os = require('os')
  const homedir = os.homedir()
  
  const possiblePaths = [
    path.join(homedir, '.claude', 'local', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(homedir, '.local', 'bin', 'claude'),
    path.join(homedir, '.npm-global', 'bin', 'claude'),
  ]
  
  // Check each path
  for (const candidatePath of possiblePaths) {
    try {
      const stats = await fs.stat(candidatePath)
      if (stats.isFile()) {
        // Check if executable
        await fs.access(candidatePath, require('fs').constants.X_OK)
        return candidatePath
      }
    } catch {
      continue
    }
  }
  
  // Try which command
  try {
    const whichResult = execSync('which claude', { encoding: 'utf8' }).trim()
    if (whichResult && !whichResult.includes('not found')) {
      // Handle alias
      if (whichResult.includes('aliased to')) {
        const aliasMatch = whichResult.match(/aliased to (.+)/)
        if (aliasMatch) {
          return aliasMatch[1]
        }
      }
      return whichResult
    }
  } catch {
    // which command failed
  }
  
  return null
}

// Helper function to test Claude CLI execution
async function testClaudeExecution(claudePath) {
  try {
    execSync(`"${claudePath}" --version`, {
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        CLAUDE_DISABLE_SHELL_SNAPSHOT: '1'
      }
    })
    return true
  } catch (error) {
    console.warn('Claude execution test failed:', error.message)
    return false
  }
}

// Helper function to get MCP servers
async function getMCPServers() {
  try {
    const configPath = path.join(require('os').homedir(), '.claude.json')
    const configData = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(configData)
    
    if (config.mcpServers && typeof config.mcpServers === 'object') {
      return Object.keys(config.mcpServers)
    }
    
    return []
  } catch (error) {
    console.warn('Failed to read MCP servers:', error.message)
    return []
  }
}
