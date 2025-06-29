const { ClaudeCodeProvider } = require('./aiProviders/claudeCodeProvider')
// Future providers can be imported here
// const { OpenAIProvider } = require('./aiProviders/openAIProvider')
// const { GeminiProvider } = require('./aiProviders/geminiProvider')

class AIProviderManager {
  constructor() {
    this.providers = new Map()
    this.currentProvider = null
    
    // Register available providers
    this.registerProvider('claude-code', new ClaudeCodeProvider())
    // this.registerProvider('openai', new OpenAIProvider())
    // this.registerProvider('gemini', new GeminiProvider())
    
    // Set default provider
    this.setProvider('claude-code')
  }

  registerProvider(id, provider) {
    this.providers.set(id, provider)
  }

  setProvider(id) {
    const provider = this.providers.get(id)
    if (!provider) {
      throw new Error(`Provider ${id} not found`)
    }
    
    // Remove listeners from previous provider
    if (this.currentProvider) {
      this.currentProvider.removeAllListeners()
    }
    
    this.currentProvider = provider
    this.currentProviderId = id
    
    return provider
  }

  getProvider() {
    if (!this.currentProvider) {
      throw new Error('No provider set')
    }
    return this.currentProvider
  }

  getAvailableProviders() {
    const providers = []
    for (const [id, provider] of this.providers) {
      providers.push({
        id,
        ...provider.getInfo()
      })
    }
    return providers
  }

  async checkProviderAvailability() {
    const results = {}
    for (const [id, provider] of this.providers) {
      results[id] = await provider.isAvailable()
    }
    return results
  }

  getCurrentProviderId() {
    return this.currentProviderId
  }

  // Proxy methods to current provider
  async executePlan(jobId, prd, workingDir) {
    return this.getProvider().executePlan(jobId, prd, workingDir)
  }

  async pauseJob(jobId) {
    return this.getProvider().pauseJob(jobId)
  }

  async resumeJob(jobId) {
    return this.getProvider().resumeJob(jobId)
  }

  async stopJob(jobId) {
    return this.getProvider().stopJob(jobId)
  }

  getActiveJobs() {
    return this.getProvider().getActiveJobs()
  }

  // Event forwarding
  on(event, handler) {
    this.getProvider().on(event, handler)
  }

  removeAllListeners() {
    if (this.currentProvider) {
      this.currentProvider.removeAllListeners()
    }
  }
}

module.exports = { AIProviderManager }