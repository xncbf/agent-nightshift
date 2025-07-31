interface ChunkInfo {
  chunks: string[]
  totalChunks: number
  estimatedTokens: number
}

export class PromptChunker {
  // Approximate token limit per chunk (conservative estimate)
  private static readonly MAX_TOKENS_PER_CHUNK = 3000
  // Approximate characters per token (varies by language)
  private static readonly CHARS_PER_TOKEN = 3.5
  private static readonly MAX_CHARS_PER_CHUNK = this.MAX_TOKENS_PER_CHUNK * this.CHARS_PER_TOKEN

  /**
   * Splits large prompts by double newlines (task boundaries)
   */
  static chunkPrompt(prompt: string): ChunkInfo {
    const trimmedPrompt = prompt.trim()
    const estimatedTokens = Math.ceil(trimmedPrompt.length / this.CHARS_PER_TOKEN)
    
    // If small enough, return as single chunk
    if (trimmedPrompt.length <= this.MAX_CHARS_PER_CHUNK) {
      return {
        chunks: [trimmedPrompt],
        totalChunks: 1,
        estimatedTokens
      }
    }

    // Split by double newlines (task boundaries)
    const chunks = this.simpleChunk(trimmedPrompt)
    
    return {
      chunks,
      totalChunks: chunks.length,
      estimatedTokens
    }
  }

  /**
   * Simple chunking by double newlines (task boundaries)
   */
  private static simpleChunk(text: string): string[] {
    // Split by double newlines (task boundaries)
    const tasks = text.split(/\n\n+/).filter(task => task.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ''
    
    for (const task of tasks) {
      const potentialChunk = currentChunk ? currentChunk + '\n\n' + task : task
      
      if (potentialChunk.length > this.MAX_CHARS_PER_CHUNK) {
        // Current chunk is full, start new one
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = task
        } else {
          // Single task is too large, split it smartly
          chunks.push(...this.splitLargeTask(task))
        }
      } else {
        currentChunk = potentialChunk
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks
  }

  /**
   * Splits a single large task into smaller pieces
   */
  private static splitLargeTask(task: string): string[] {
    const chunks: string[] = []
    const words = task.split(/\s+/)
    let currentChunk = ''
    
    for (const word of words) {
      const potentialChunk = currentChunk ? currentChunk + ' ' + word : word
      
      if (potentialChunk.length > this.MAX_CHARS_PER_CHUNK) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = word
        } else {
          // Single word too long, just add it
          chunks.push(word)
        }
      } else {
        currentChunk = potentialChunk
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks
  }

  /**
   * Creates a summary prompt for multi-chunk processing
   */
  static createSummaryPrompt(chunks: string[], currentChunk: number): string {
    return `This is part ${currentChunk + 1} of ${chunks.length} of a large prompt. 
Please analyze this section and note the key requirements. 
I will provide the remaining parts shortly.

${chunks[currentChunk]}`
  }

  /**
   * Creates a final consolidation prompt
   */
  static createConsolidationPrompt(totalChunks: number): string {
    return `I've now provided all ${totalChunks} parts of the requirements.
Please create a comprehensive workflow plan that includes all the tasks from all parts.
Make sure to:
1. Include every task mentioned across all parts
2. Identify dependencies between tasks
3. Organize them in a logical execution order
4. Estimate time for each task`
  }
}