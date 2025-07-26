/**
 * AI Prompt Management File
 * Manages prompts commonly used by OpenAI and Claude API services.
 */

export class AIPrompts {
  /**
   * Returns dependency analysis rules.
   */
  static getDependencyAnalysisRules(): string {
    return `Dependency Analysis Rules:
- Tasks that require output from other tasks MUST have dependencies
- Setup/installation tasks should be dependencies for code/build tasks
- Testing tasks should depend on code completion tasks
- Documentation tasks can often run in parallel unless they need code completion
- Configuration tasks usually come first and are dependencies for other tasks
- Deployment tasks should depend on testing completion

IMPORTANT: Every task except the first ones should have at least one dependency. Only truly independent tasks should have empty dependencies.`;
  }

  /**
   * Returns system prompt for task analysis.
   */
  static getTaskAnalysisSystemPrompt(): string {
    return `You are a task analyzer. Given multiple prompts, determine if they should be executed in parallel or sequentially.
Analyze task dependencies carefully and return a structured execution plan.

CRITICAL: 
1. Look for dependency indicators like:
   - "After tasks X-Y complete"
   - "When X is done"
   - "Following X"
   - Task numbers referenced in the text (e.g., "after 1-2" means depends on task1 and task2)

2. Extract the clean task by removing dependency conditions from the prompt text
   - "After tasks 1-2 complete, open app" → prompt: "open app", dependencies: ["task1", "task2"]

${this.getDependencyAnalysisRules()}

Return JSON format:
{
  "executionType": "parallel" | "sequential",
  "tasks": [
    {
      "id": "task1",
      "prompt": "clean prompt without dependency conditions",
      "dependencies": [] // array of task ids this depends on - MUST be thoughtfully determined
    }
  ]
}`;
  }

  /**
   * Returns system prompt for task extraction.
   */
  static getTaskExtractionSystemPrompt(): string {
    return `You are a task extraction assistant. Extract individual tasks from text while preserving their original format.
DO NOT remove dependency conditions at this stage - they will be processed later for dependency analysis.`;
  }

  /**
   * Generates user prompt for task extraction.
   */
  static getTaskExtractionUserPrompt(content: string): string {
    return `Extract individual tasks from the following text. 
The text might be:
- A single task
- Multiple tasks separated by newlines
- A numbered list (1., 2., etc.)
- A bullet list (-, *, •)
- Mixed format

IMPORTANT: Keep the tasks exactly as written, including any dependency conditions.
These will be analyzed separately for dependencies.

Text:
${content}

Return a JSON array of extracted prompts:
{ "prompts": ["task 1", "task 2", ...] }`;
  }

  /**
   * Generates user prompt for task analysis.
   */
  static getTaskAnalysisUserPrompt(prompts: string[]): string {
    return `Analyze these prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
  }

  /**
   * Returns system prompt for plan generation.
   */
  static getPlanGenerationSystemPrompt(): string {
    return `You are a development task planner. Create a concise execution plan with proper task dependencies.

${this.getDependencyAnalysisRules()}

Return JSON format:
{
  "title": "Brief title",
  "tasks": [
    {
      "id": "unique_id",
      "name": "Task name", 
      "description": "What to do",
      "type": "code" | "research" | "test" | "deploy",
      "dependencies": [] // array of task ids this depends on - MUST be thoughtfully determined
    }
  ]
}`;
  }

  /**
   * Returns system prompt for task completion.
   */
  static getTaskCompletionSystemPrompt(): string {
    return `You are a helpful AI assistant that executes development tasks. 
When given a task, provide clear instructions and any necessary bash commands.
Format bash commands in code blocks with \`\`\`bash or \`\`\`sh.
Be concise and action-oriented.`;
  }
}