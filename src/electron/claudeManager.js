const { execSync, spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')

class ClaudeManager {
  constructor() {
    this.claudePath = null
    this.isValidated = false
    this.validationResult = null
  }

  // Claude CLI 경로 찾기
  async findClaudePath() {
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

  // Claude CLI 실행 테스트
  async testClaudeExecution(claudePath) {
    try {
      const output = execSync(`"${claudePath}" --version`, {
        encoding: 'utf8',
        timeout: 5000,
        env: {
          ...process.env,
          // 디버거 포트 충돌 방지
          NODE_OPTIONS: '',
          ELECTRON_RUN_AS_NODE: '',
          // 디버그 관련 환경변수 제거
          VSCODE_PID: '',
          VSCODE_NLS_CONFIG: ''
        }
      })
      console.log('Claude CLI version check successful:', output.trim())
      return { 
        success: true, 
        output: output.trim(),
        error: null,
        stderr: null
      }
    } catch (error) {
      console.warn('Claude execution test failed:', error.message)
      return { 
        success: false, 
        output: error.stdout ? error.stdout.toString() : '',
        error: error.message,
        stderr: error.stderr ? error.stderr.toString() : 'Unknown error'
      }
    }
  }

  // MCP 서버 목록 가져오기
  async getMCPServers() {
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

  // Claude 환경 검증
  async validateEnvironment() {
    console.log('ClaudeManager: Validating Claude environment')
    
    const result = {
      isValid: false,
      claudePath: null,
      mcpServers: [],
      errors: [],
      warnings: []
    }
    
    try {
      // 1. Find Claude CLI path
      const claudePath = await this.findClaudePath()
      if (!claudePath) {
        result.errors.push('Claude CLI not found. Please install Claude Code.')
        return result
      }
      
      result.claudePath = claudePath
      this.claudePath = claudePath
      
      // 2. Test Claude CLI execution
      const executionTest = await this.testClaudeExecution(claudePath)
      if (!executionTest.success) {
        result.errors.push(`Claude CLI found but cannot execute properly: ${executionTest.error}`)
        result.errors.push(`Command output: ${executionTest.stderr || 'No stderr output'}`)
        return result
      }
      
      // 3. Get MCP servers
      const mcpServers = await this.getMCPServers()
      result.mcpServers = mcpServers
      
      if (mcpServers.length === 0) {
        result.warnings.push('No MCP servers configured. Some features may not work.')
      }
      
      // 4. Check for required MCP servers
      const requiredMCPs = ['chatgpt', 'filesystem']
      const missingMCPs = requiredMCPs.filter(mcp => 
        !mcpServers.some(server => server.toLowerCase().includes(mcp))
      )
      
      if (missingMCPs.length > 0) {
        result.warnings.push(`Recommended MCP servers not found: ${missingMCPs.join(', ')}`)
      }
      
      result.isValid = true
      this.isValidated = true
      this.validationResult = result
      console.log('✅ Claude environment validation successful')
      return result
      
    } catch (error) {
      console.error('❌ Claude environment validation failed:', error)
      result.errors.push(`Validation failed: ${error.message}`)
      return result
    }
  }

  // Claude 명령어 실행
  async executeCommand(options) {
    const { claudePath, args, workDirectory, timeout = 300000, env = {} } = options
    
    // 전달된 claudePath 사용 (validate는 이미 완료된 상태)
    const actualClaudePath = claudePath
    
    if (!actualClaudePath) {
      throw new Error('Claude CLI path not provided. Validation should be done before calling executeCommand.')
    }
    
    console.log('ClaudeManager: Executing Claude command:', { claudePath: actualClaudePath, args, workDirectory })
    
    try {
      return new Promise((resolve) => {
        console.log('ClaudeManager: About to spawn process with:', {
          command: actualClaudePath,
          args: args,
          cwd: workDirectory
        })
        
        const claudeProcess = spawn(actualClaudePath, args, {
          cwd: workDirectory,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            ...env,
            // 디버거 포트 충돌만 방지 (API 키 등은 유지)
            NODE_OPTIONS: undefined,
            ELECTRON_RUN_AS_NODE: undefined
          }
        })
        
        console.log('ClaudeManager: Process spawned, PID:', claudeProcess.pid)
        
        // stdin을 즉시 종료해서 대화형 모드 방지
        claudeProcess.stdin.end()
        
        let output = ''
        let error = ''
        let hasStarted = false
        
        claudeProcess.stdout.on('data', (data) => {
          if (!hasStarted) {
            console.log('ClaudeManager: First stdout data received - process started successfully')
            hasStarted = true
          }
          output += data.toString()
          console.log(`Claude stdout: ${data.toString()}`)
        })
        
        claudeProcess.stderr.on('data', (data) => {
          const errorText = data.toString()
          error += errorText
          // Don't log shell snapshot errors
          if (!errorText.includes('shell-snapshots')) {
            console.error(`Claude stderr: ${errorText}`)
          }
        })
        
        // 프로세스 시작 즉시 확인
        claudeProcess.on('spawn', () => {
          console.log('ClaudeManager: Process spawn event fired - process starting')
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
          console.error('Claude process details:', { claudePath: actualClaudePath, args, workDirectory })
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
  }

  // 간단한 Claude 실행 (기존 execute-claude 핸들러용)
  async executeSimple(prompt) {
    console.log('ClaudeManager: Executing simple Claude command with prompt length:', prompt.length)
    
    if (!this.claudePath) {
      const validation = await this.validateEnvironment()
      if (!validation.isValid) {
        return { success: false, error: 'Claude CLI not available' }
      }
    }
    
    return new Promise((resolve) => {
      const claudeProcess = spawn(this.claudePath, ['-p', prompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // 디버거 포트 충돌 방지
          NODE_OPTIONS: '',
          ELECTRON_RUN_AS_NODE: '',
          // 디버그 관련 환경변수 제거
          VSCODE_PID: '',
          VSCODE_NLS_CONFIG: ''
        }
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
  }

  // 검증 결과 캐시 가져오기
  getValidationResult() {
    return this.validationResult
  }

  // Claude CLI 경로 가져오기
  getClaudePath() {
    return this.claudePath
  }

  // 검증 상태 확인
  isValid() {
    return this.isValidated && this.validationResult?.isValid
  }
}

module.exports = { ClaudeManager }