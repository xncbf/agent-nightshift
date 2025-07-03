import OpenAI from 'openai';

class OpenAIService {
  private client: OpenAI | null = null;
  private apiKey: string | null = null;
  private model: string = 'gpt-4o-mini';

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  
  setModel(model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') {
    this.model = model;
    localStorage.setItem('openai_model', model);
  }
  
  getModel(): 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo' {
    return (localStorage.getItem('openai_model') as 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo') || 'gpt-4o-mini';
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
      throw new Error('OpenAI API key not configured');
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

    const extractResponse = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a task extraction assistant. Extract individual tasks from text.' },
        { role: 'user', content: extractionPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const { prompts } = JSON.parse(extractResponse.choices[0].message.content || '{"prompts": []}')
    
    if (prompts.length === 0) {
      // If extraction failed, treat the whole content as one prompt
      prompts.push(content)
    }

    // Now analyze the extracted prompts
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze these prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}` }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
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
      throw new Error('OpenAI API key not configured');
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze these prompts:\n${prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}` }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
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
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a development task planner. Create a concise execution plan.
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
}`
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  async generateCompletion(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a helpful AI assistant that executes development tasks. 
When given a task, provide clear instructions and any necessary bash commands.
Format bash commands in code blocks with \`\`\`bash or \`\`\`sh.
Be concise and action-oriented.`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content || '';
  }
}

export const openaiService = new OpenAIService();