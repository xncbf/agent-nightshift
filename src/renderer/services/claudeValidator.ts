// Claude CLI 설정 및 MCP 서버 검증 서비스
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface ClaudeValidationResult {
  isValid: boolean;
  claudePath?: string;
  mcpServers: string[];
  errors: string[];
  warnings: string[];
}

export class ClaudeValidator {
  private static instance: ClaudeValidator;
  private cachedResult: ClaudeValidationResult | null = null;
  
  static getInstance(): ClaudeValidator {
    if (!ClaudeValidator.instance) {
      ClaudeValidator.instance = new ClaudeValidator();
    }
    return ClaudeValidator.instance;
  }
  
  // 캐시 무효화
  invalidateCache(): void {
    this.cachedResult = null;
  }
  
  // 전체 검증 실행
  async validate(forceRecheck = false): Promise<ClaudeValidationResult> {
    if (this.cachedResult && !forceRecheck) {
      return this.cachedResult;
    }
    
    const result: ClaudeValidationResult = {
      isValid: true,
      mcpServers: [],
      errors: [],
      warnings: []
    };
    
    try {
      // 1. Claude CLI 경로 확인
      const claudePath = await this.findClaudePath();
      if (!claudePath) {
        result.isValid = false;
        result.errors.push('Claude CLI not found. Please install Claude Code.');
        return result;
      }
      
      result.claudePath = claudePath;
      
      // 2. Claude CLI 실행 가능 여부 확인
      const canExecute = await this.testClaudeExecution(claudePath);
      if (!canExecute) {
        result.isValid = false;
        result.errors.push('Claude CLI found but cannot execute properly.');
        return result;
      }
      
      // 3. MCP 서버 설정 확인
      const mcpServers = await this.getMCPServers();
      result.mcpServers = mcpServers;
      
      if (mcpServers.length === 0) {
        result.warnings.push('No MCP servers configured. Some features may not work.');
      }
      
      // 4. 특정 MCP 서버 확인 (옵션)
      const requiredMCPs = ['chatgpt', 'filesystem'];
      const missingMCPs = requiredMCPs.filter(mcp => 
        !mcpServers.some(server => server.toLowerCase().includes(mcp))
      );
      
      if (missingMCPs.length > 0) {
        result.warnings.push(`Recommended MCP servers not found: ${missingMCPs.join(', ')}`);
      }
      
      this.cachedResult = result;
      return result;
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }
  
  // Claude CLI 경로 찾기
  private async findClaudePath(): Promise<string | null> {
    const possiblePaths = [
      // 일반적인 설치 경로들
      '/Users/' + process.env.USER + '/.claude/local/claude',
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      process.env.HOME + '/.claude/local/claude',
      // npm 글로벌 설치
      process.env.HOME + '/.npm-global/bin/claude',
      // Alias 확인
      this.getAliasPath()
    ].filter(Boolean);
    
    // 각 경로 확인
    for (const path of possiblePaths) {
      if (path && fs.existsSync(path)) {
        try {
          // 실행 권한 확인
          await fs.promises.access(path, fs.constants.X_OK);
          return path;
        } catch {
          continue;
        }
      }
    }
    
    // which 명령어로 확인
    try {
      const whichResult = execSync('which claude', { encoding: 'utf8' }).trim();
      if (whichResult && !whichResult.includes('not found')) {
        return whichResult;
      }
    } catch {
      // which 실패 시 무시
    }
    
    return null;
  }
  
  // Shell alias에서 Claude 경로 추출
  private getAliasPath(): string | null {
    try {
      const aliasResult = execSync('alias claude', { encoding: 'utf8' }).trim();
      const match = aliasResult.match(/claude='([^']+)'/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  
  // Claude CLI 실행 테스트
  private async testClaudeExecution(claudePath: string): Promise<boolean> {
    try {
      // 간단한 테스트 명령어 실행
      const testResult = execSync(`"${claudePath}" -p "test" --dry-run`, {
        encoding: 'utf8',
        timeout: 5000,
        env: {
          ...process.env,
          CLAUDE_DISABLE_SHELL_SNAPSHOT: '1'
        }
      });
      
      // 오류 없이 실행되면 성공
      return true;
    } catch (error) {
      console.warn('Claude execution test failed:', error);
      return false;
    }
  }
  
  // MCP 서버 목록 가져오기
  private async getMCPServers(): Promise<string[]> {
    try {
      // Claude 설정 파일 읽기
      const configPath = path.join(process.env.HOME || '', '.claude.json');
      
      if (!fs.existsSync(configPath)) {
        return [];
      }
      
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (config.mcpServers && typeof config.mcpServers === 'object') {
        return Object.keys(config.mcpServers);
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to read MCP servers:', error);
      return [];
    }
  }
  
  // 특정 MCP 서버 확인
  async hasMCPServer(serverName: string): Promise<boolean> {
    const result = await this.validate();
    return result.mcpServers.some(server => 
      server.toLowerCase().includes(serverName.toLowerCase())
    );
  }
  
  // 검증 결과를 UI에 표시할 형태로 변환
  getValidationSummary(result: ClaudeValidationResult): string {
    const parts = [];
    
    if (result.isValid) {
      parts.push('✅ Claude CLI: Ready');
      parts.push(`📍 Path: ${result.claudePath}`);
    } else {
      parts.push('❌ Claude CLI: Not Ready');
    }
    
    if (result.mcpServers.length > 0) {
      parts.push(`🔧 MCP Servers: ${result.mcpServers.join(', ')}`);
    } else {
      parts.push('⚠️ MCP Servers: None configured');
    }
    
    if (result.errors.length > 0) {
      parts.push(`❌ Errors: ${result.errors.join('; ')}`);
    }
    
    if (result.warnings.length > 0) {
      parts.push(`⚠️ Warnings: ${result.warnings.join('; ')}`);
    }
    
    return parts.join('\n');
  }
}