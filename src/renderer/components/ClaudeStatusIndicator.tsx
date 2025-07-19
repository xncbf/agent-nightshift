import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'

interface ClaudeValidationResult {
  isValid: boolean
  claudePath: string | null
  mcpServers: string[]
  errors: string[]
  warnings: string[]
}

export const ClaudeStatusIndicator: React.FC = () => {
  const [validation, setValidation] = useState<ClaudeValidationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const checkClaudeStatus = async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.validateClaudeEnvironment()
      setValidation(result)
      // Show details automatically if there are errors
      if (!result.isValid) {
        setShowDetails(true)
      }
    } catch (error) {
      console.error('Failed to validate Claude environment:', error)
      setValidation({
        isValid: false,
        claudePath: null,
        mcpServers: [],
        errors: ['Failed to validate Claude environment'],
        warnings: []
      })
      setShowDetails(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkClaudeStatus()
  }, [])

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    }
    
    if (!validation) {
      return <XCircle className="w-4 h-4 text-red-500" />
    }

    if (!validation.isValid) {
      return <XCircle className="w-4 h-4 text-red-500" />
    }

    if (validation.warnings.length > 0) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    }

    return <CheckCircle className="w-4 h-4 text-green-500" />
  }

  const getStatusText = () => {
    if (isLoading) return 'Claude CLI 상태 확인 중...'
    if (!validation) return 'Claude CLI 상태 불명'
    if (!validation.isValid) return 'Claude CLI 실행 불가'
    if (validation.warnings.length > 0) return 'Claude CLI 사용 가능 (경고 있음)'
    return 'Claude CLI 준비 완료'
  }

  const getStatusColor = () => {
    if (isLoading) return 'text-blue-600'
    if (!validation?.isValid) return 'text-red-600'
    if (validation?.warnings.length > 0) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </h3>
            {validation?.claudePath && (
              <p className="text-xs text-gray-500 mt-1">
                경로: {validation.claudePath}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={checkClaudeStatus}
            disabled={isLoading}
            className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            새로고침
          </button>
          
          {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              {showDetails ? '숨기기' : '상세보기'}
            </button>
          )}
        </div>
      </div>

      {showDetails && validation && (
        <div className="mt-4 space-y-3">
          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <h4 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                오류
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="break-words">• {error}</li>
                ))}
              </ul>
              
              {validation.errors.some(error => error.includes('not found') || error.includes('cannot execute')) && (
                <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm">
                  <p className="font-medium text-red-800 dark:text-red-200 mb-1">해결 방법:</p>
                  <ol className="text-red-700 dark:text-red-300 space-y-1 ml-4">
                    <li>1. Claude Code가 설치되어 있는지 확인</li>
                    <li>2. 터미널에서 <code className="bg-red-200 dark:bg-red-800 px-1 rounded">claude --version</code> 실행 테스트</li>
                    <li>3. PATH 환경변수에 Claude CLI가 포함되어 있는지 확인</li>
                  </ol>
                  <a
                    href="https://docs.anthropic.com/claude/docs/claude-code"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-red-600 dark:text-red-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Claude Code 설치 가이드
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                경고
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index} className="break-words">• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* MCP Servers */}
          {validation.mcpServers.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                설정된 MCP 서버 ({validation.mcpServers.length}개)
              </h4>
              <div className="flex flex-wrap gap-1">
                {validation.mcpServers.map((server, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded"
                  >
                    {server}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}