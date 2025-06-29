class ClaudeService {
  async extractAndAnalyzePrompts(content: string): Promise<{
    executionType: 'parallel' | 'sequential';
    tasks: Array<{
      id: string;
      prompt: string;
      dependencies?: string[];
    }>;
  }> {
    try {
      // Call Claude Code CLI to analyze the content
      const analysisPrompt = `Analyze the following content and determine if it contains multiple tasks that should be executed in parallel or sequentially:

${content}

Please provide a JSON response with this exact format:
{
  "executionType": "parallel" | "sequential",
  "tasks": [
    {
      "id": "task1",
      "prompt": "extracted task description",
      "dependencies": []
    }
  ]
}

Rules:
- If the content is a single task, return one task
- If multiple independent tasks, suggest parallel execution
- If tasks depend on each other, suggest sequential execution
- Extract clean, actionable task descriptions`;

      const result = await this.callClaudeCodeCLI(analysisPrompt);
      
      try {
        const parsed = JSON.parse(result);
        return parsed;
      } catch (parseError) {
        console.warn('Failed to parse Claude Code response, using fallback');
        return this.fallbackExtractAndAnalyze(content);
      }
    } catch (error) {
      console.warn('Failed to call Claude Code CLI, using fallback:', error);
      return this.fallbackExtractAndAnalyze(content);
    }
  }

  private fallbackExtractAndAnalyze(content: string): {
    executionType: 'parallel' | 'sequential';
    tasks: Array<{
      id: string;
      prompt: string;
      dependencies?: string[];
    }>;
  } {
    // Split content by lines and filter out empty lines
    const lines = content.split('\n').filter(line => line.trim());
    
    // If only one line or looks like a single task, treat as single task
    if (lines.length <= 1 || !this.hasMultipleTasks(content)) {
      return {
        executionType: 'sequential',
        tasks: [{
          id: 'task1',
          prompt: content.trim(),
          dependencies: []
        }]
      };
    }
    
    // Extract multiple tasks
    const tasks = this.extractTasks(content);
    
    // For Claude Code, we prefer sequential execution as it's more reliable
    return {
      executionType: 'sequential',
      tasks: tasks.map((prompt, index) => ({
        id: `task${index + 1}`,
        prompt: prompt.trim(),
        dependencies: index === 0 ? [] : [`task${index}`]
      }))
    };
  }

  async generatePlan(prompt: string): Promise<{
    title: string;
    tasks: Array<{
      id: string;
      name: string;
      description: string;
      type: 'code' | 'research' | 'test' | 'deploy';
    }>;
  }> {
    try {
      // Call Claude Code CLI to analyze the prompt and generate a plan
      const analysisPrompt = `Analyze this request and create a detailed step-by-step plan:

${prompt}

Please provide a JSON response with this exact format:
{
  "title": "Brief project title",
  "tasks": [
    {
      "id": "task1",
      "name": "Task name",
      "description": "Detailed description",
      "type": "code"
    }
  ]
}

Break down the request into specific, actionable tasks. Each task should be concrete and implementable.`;

      const result = await this.callClaudeCodeCLI(analysisPrompt);
      
      try {
        const parsed = JSON.parse(result);
        return parsed;
      } catch (parseError) {
        console.warn('Failed to parse Claude Code response, using fallback');
        // Fallback to simple plan
        return {
          title: this.extractTitle(prompt),
          tasks: [{
            id: 'claude_execute',
            name: 'Execute with Claude Code',
            description: prompt,
            type: 'code'
          }]
        };
      }
    } catch (error) {
      console.warn('Failed to call Claude Code CLI, using fallback:', error);
      // Fallback to simple plan
      return {
        title: this.extractTitle(prompt),
        tasks: [{
          id: 'claude_execute', 
          name: 'Execute with Claude Code',
          description: prompt,
          type: 'code'
        }]
      };
    }
  }

  private async callClaudeCodeCLI(prompt: string): Promise<string> {
    // Use electron IPC to call Claude CLI from main process
    try {
      if (window.electronAPI && (window.electronAPI as any).executeClaude) {
        const result = await (window.electronAPI as any).executeClaude(prompt);
        if (result.success) {
          return result.output;
        } else {
          throw new Error(result.error || 'Claude CLI execution failed');
        }
      } else {
        throw new Error('Claude CLI not available');
      }
    } catch (error) {
      console.error('Claude CLI call failed:', error);
      throw error;
    }
  }

  private hasMultipleTasks(content: string): boolean {
    // Check for common patterns that indicate multiple tasks
    const patterns = [
      /^\d+\./gm,  // Numbered lists (1., 2., etc.)
      /^[-*•]/gm,  // Bullet points
      /\n\s*[-*•]/g, // Bullet points with whitespace
      /\n\s*\d+\./g  // Numbered lists with whitespace
    ];
    
    return patterns.some(pattern => {
      const matches = content.match(pattern);
      return matches && matches.length > 1;
    });
  }

  private extractTasks(content: string): string[] {
    // Try to extract individual tasks from various formats
    const lines = content.split('\n');
    const tasks: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Remove common list prefixes
      const cleaned = trimmed
        .replace(/^\d+\.\s*/, '')  // Remove "1. ", "2. ", etc.
        .replace(/^[-*•]\s*/, '')  // Remove "- ", "* ", "• "
        .trim();
      
      if (cleaned) {
        tasks.push(cleaned);
      }
    }
    
    // If no tasks extracted, treat the whole content as one task
    return tasks.length > 0 ? tasks : [content.trim()];
  }

  private extractTitle(prompt: string): string {
    // Extract a reasonable title from the prompt
    const firstLine = prompt.split('\n')[0].trim();
    
    // If it's too long, truncate it
    if (firstLine.length > 50) {
      return firstLine.substring(0, 47) + '...';
    }
    
    return firstLine || 'Claude Code Task';
  }
}

export const claudeService = new ClaudeService();