/**
 * AI 프롬프트 관리 파일
 * OpenAI와 Claude API 서비스에서 공통으로 사용하는 프롬프트들을 관리합니다.
 */

export class AIPrompts {
  /**
   * 의존성 분석 규칙을 반환합니다.
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
   * 태스크 분석용 시스템 프롬프트를 반환합니다.
   */
  static getTaskAnalysisSystemPrompt(): string {
    return `You are a task analyzer. Given multiple prompts, determine if they should be executed in parallel or sequentially.
Analyze task dependencies carefully and return a structured execution plan.

${this.getDependencyAnalysisRules()}

Return JSON format:
{
  "executionType": "parallel" | "sequential",
  "tasks": [
    {
      "id": "task1",
      "prompt": "original prompt",
      "dependencies": [] // array of task ids this depends on - MUST be thoughtfully determined
    }
  ]
}`;
  }

  /**
   * 태스크 추출용 시스템 프롬프트를 반환합니다.
   */
  static getTaskExtractionSystemPrompt(): string {
    return 'You are a task extraction assistant. Extract individual tasks from text.';
  }

  /**
   * 태스크 추출용 사용자 프롬프트를 생성합니다.
   */
  static getTaskExtractionUserPrompt(content: string): string {
    return `Extract individual tasks/prompts from the following text. 
The text might be:
- A single task
- Multiple tasks separated by newlines
- A numbered list (1., 2., etc.)
- A bullet list (-, *, •)
- Mixed format

Extract each distinct task as a separate item. Clean up formatting but preserve the intent.

Text:
${content}

Return a JSON array of extracted prompts:
{ "prompts": ["task 1", "task 2", ...] }`;
  }

  /**
   * 태스크 분석용 사용자 프롬프트를 생성합니다.
   */
  static getTaskAnalysisUserPrompt(prompts: string[]): string {
    return `Analyze these prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
  }

  /**
   * 플랜 생성용 시스템 프롬프트를 반환합니다.
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
   * 태스크 완료용 시스템 프롬프트를 반환합니다.
   */
  static getTaskCompletionSystemPrompt(): string {
    return `You are a helpful AI assistant that executes development tasks. 
When given a task, provide clear instructions and any necessary bash commands.
Format bash commands in code blocks with \`\`\`bash or \`\`\`sh.
Be concise and action-oriented.`;
  }
}