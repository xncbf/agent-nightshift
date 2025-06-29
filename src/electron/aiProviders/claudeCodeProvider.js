const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs').promises
const os = require('os')
const { BaseAIProvider } = require('./baseProvider')

class ClaudeCodeProvider extends BaseAIProvider {
  constructor() {
    super()
    this.name = 'Claude Code'
    this.version = '1.0.0'
    this.processes = new Map()
  }

  async executePlan(jobId, prd, workingDir) {
    try {
      // Create a temporary file with the PRD content
      const tmpDir = os.tmpdir()
      const prdPath = path.join(tmpDir, `prd-${jobId}.md`)
      
      await fs.writeFile(prdPath, prd, 'utf8')
      
      // Build the Claude Code command
      const message = `Please read the PRD file at ${prdPath} and execute the development plan step by step. For each task, provide status updates in JSON format with fields: taskId, status, and message.`
      
      const args = [
        '-p',
        message,
        '--output-format', 'json'
      ]

      // Spawn Claude Code process
      // Try to find claude in common locations
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
      
      const claudeProcess = spawn(claudePath, args, {
        cwd: workingDir || process.cwd(),
        env: { ...process.env }
      })

      this.processes.set(jobId, { process: claudeProcess, prdPath })

      // Handle stdout (Claude's responses)
      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString()
        
        // Split long outputs into chunks and emit separately
        const lines = output.split('\n').filter(line => line.trim())
        
        lines.forEach(line => {
          // Emit different types of logs based on content
          let logType = 'claude'
          let formattedLine = line
          
          if (line.includes('Error') || line.includes('Failed')) {
            logType = 'error'
            formattedLine = `❌ ${line}`
          } else if (line.includes('Success') || line.includes('✓') || line.includes('completed')) {
            logType = 'success'
            formattedLine = `✅ ${line}`
          } else if (line.startsWith('$') || line.includes('Running:') || line.includes('Executing:')) {
            logType = 'command'
            formattedLine = `💻 ${line}`
          } else if (line.includes('Claude:') || line.includes('🤖')) {
            logType = 'claude'
            formattedLine = `🤖 Claude: ${line.replace(/^(Claude:|\ud83e\udd16)/, '').trim()}`
          } else {
            formattedLine = `📝 ${line}`
          }
          
          this.emit('output', { jobId, data: formattedLine, type: logType })
        })
        
        // Try to parse JSON status updates
        try {
          for (const line of lines) {
            if (line.startsWith('{') && line.endsWith('}')) {
              const status = JSON.parse(line)
              this.emit('task-update', { jobId, ...status })
            }
          }
        } catch (err) {
          // Not JSON, just regular output
        }
      })

      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        this.emit('error', { jobId, error: data.toString() })
      })

      // Handle process exit
      claudeProcess.on('exit', async (code) => {
        this.emit('complete', { jobId, code })
        
        // Clean up temporary file
        try {
          await fs.unlink(prdPath)
        } catch (err) {
          console.error('Failed to clean up PRD file:', err)
        }
        
        this.processes.delete(jobId)
      })

      return { success: true, pid: claudeProcess.pid }

    } catch (error) {
      this.emit('error', { jobId, error: error.message })
      return { success: false, error: error.message }
    }
  }

  async pauseJob(jobId) {
    const job = this.processes.get(jobId)
    if (job && job.process) {
      job.process.kill('SIGSTOP')
      return { success: true }
    }
    return { success: false, error: 'Job not found' }
  }

  async resumeJob(jobId) {
    const job = this.processes.get(jobId)
    if (job && job.process) {
      job.process.kill('SIGCONT')
      return { success: true }
    }
    return { success: false, error: 'Job not found' }
  }

  async stopJob(jobId) {
    const job = this.processes.get(jobId)
    if (job && job.process) {
      job.process.kill('SIGTERM')
      this.processes.delete(jobId)
      return { success: true }
    }
    return { success: false, error: 'Job not found' }
  }

  getActiveJobs() {
    return Array.from(this.processes.keys())
  }

  async isAvailable() {
    try {
      const { execSync } = require('child_process')
      execSync('claude --version', { stdio: 'ignore' })
      return true
    } catch (error) {
      return false
    }
  }

  getInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: ['prd-execution', 'task-tracking', 'pause-resume', 'json-output']
    }
  }
}

module.exports = { ClaudeCodeProvider }
