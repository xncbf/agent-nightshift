import Anthropic from '@anthropic-ai/sdk';

class ClaudeApiService {
  private client: Anthropic | null = null;
  private apiKey: string | null = null;
  private model: string = 'claude-sonnet-4-0';

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  
  setModel(model: 'claude-sonnet-4-0' | 'claude-opus-4-0') {
    this.model = model;
    localStorage.setItem('claude_model', model);
  }
  
  getModel(): 'claude-sonnet-4-0' | 'claude-opus-4-0' {
    return (localStorage.getItem('claude_model') as 'claude-sonnet-4-0' | 'claude-opus-4-0') || 'claude-sonnet-4-0';
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async extractAndAnalyzePrompts(content: string): Promise<{
    executionType: 'parallel' | 'sequential';
    tasks: Array<{
      id: string;
      prompt: string;
      dependencies?: string[];
    }>;
  }> {
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const systemPrompt = `You are a task analyzer. Given multiple prompts, determine if they should be executed in parallel or sequentially.
Consider dependencies between tasks and return a structured execution plan.

Rules:
- If tasks are independent, suggest parallel execution
- If tasks have dependencies or build on each other, suggest sequential execution
- Identify explicit dependencies between tasks

Return JSON format:
{
  "executionType": "parallel" | "sequential",
  "tasks": [
    {
      "id": "task1",
      "prompt": "original prompt",
      "dependencies": [] // array of task ids this depends on
    }
  ]
}`;

    const extractionPrompt = `Extract individual tasks/prompts from the following text. 
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

    const extractResponse = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [
        { role: 'user', content: extractionPrompt }
      ]
    });

    let prompts: string[] = [];
    try {
      const extractedData = JSON.parse(extractResponse.content[0].type === 'text' ? extractResponse.content[0].text : '{"prompts": []}');
      prompts = extractedData.prompts || [];
    } catch (error) {
      // If extraction failed, treat the whole content as one prompt
      prompts = [content];
    }

    if (prompts.length === 0) {
      prompts.push(content);
    }

    // Now analyze the extracted prompts
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Analyze these prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}` }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(responseText);
  }

  async analyzePrompts(prompts: string[]): Promise<{
    executionType: 'parallel' | 'sequential';
    tasks: Array<{
      id: string;
      prompt: string;
      dependencies?: string[];
    }>;
  }> {
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const systemPrompt = `You are a task analyzer. Given multiple prompts, determine if they should be executed in parallel or sequentially.
Consider dependencies between tasks and return a structured execution plan.

Rules:
- If tasks are independent, suggest parallel execution
- If tasks have dependencies or build on each other, suggest sequential execution
- Identify explicit dependencies between tasks

Return JSON format:
{
  "executionType": "parallel" | "sequential",
  "tasks": [
    {
      "id": "task1",
      "prompt": "original prompt",
      "dependencies": [] // array of task ids this depends on
    }
  ]
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Analyze these prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}` }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(responseText);
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
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const systemPrompt = `You are a development task planner. Create a concise execution plan.
Return JSON format:
{
  "title": "Brief title",
  "tasks": [
    {
      "id": "unique_id",
      "name": "Task name",
      "description": "What to do",
      "type": "code" | "research" | "test" | "deploy"
    }
  ]
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(responseText);
  }
}

export const claudeApiService = new ClaudeApiService();