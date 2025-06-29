const EventEmitter = require('events')

/**
 * Base class for AI providers
 * All AI providers should extend this class
 */
class BaseAIProvider extends EventEmitter {
  constructor() {
    super()
    this.name = 'BaseProvider'
    this.version = '1.0.0'
  }

  /**
   * Execute a development plan based on PRD
   * @param {string} jobId - Unique job identifier
   * @param {string} prd - Product Requirements Document content
   * @param {string} workingDir - Working directory path
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async executePlan(jobId, prd, workingDir) {
    throw new Error('executePlan must be implemented by subclass')
  }

  /**
   * Pause a running job
   * @param {string} jobId - Job to pause
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async pauseJob(jobId) {
    throw new Error('pauseJob must be implemented by subclass')
  }

  /**
   * Resume a paused job
   * @param {string} jobId - Job to resume
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resumeJob(jobId) {
    throw new Error('resumeJob must be implemented by subclass')
  }

  /**
   * Stop a running job
   * @param {string} jobId - Job to stop
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async stopJob(jobId) {
    throw new Error('stopJob must be implemented by subclass')
  }

  /**
   * Get list of active jobs
   * @returns {string[]} Array of job IDs
   */
  getActiveJobs() {
    throw new Error('getActiveJobs must be implemented by subclass')
  }

  /**
   * Check if provider is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return false
  }

  /**
   * Get provider info
   * @returns {{name: string, version: string, capabilities: string[]}}
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: []
    }
  }
}

module.exports = { BaseAIProvider }