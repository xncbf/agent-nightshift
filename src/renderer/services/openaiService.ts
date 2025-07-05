import OpenAI from 'openai';
import { AIPrompts } from './prompts';

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

    const extractResponse = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: AIPrompts.getTaskExtractionSystemPrompt() },
        { role: 'user', content: AIPrompts.getTaskExtractionUserPrompt(content) }
      ],
      response_format: { type: 'json_object' }
    });

    const { prompts } = JSON.parse(extractResponse.choices[0].message.content || '{"prompts": []}')
    
    if (prompts.length === 0) {
      // If extraction failed, treat the whole content as one prompt
      prompts.push(content)
    }

    // Now analyze the extracted prompts using the shared method
    return await this.analyzePrompts(prompts);
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: AIPrompts.getTaskAnalysisSystemPrompt() },
        { role: 'user', content: AIPrompts.getTaskAnalysisUserPrompt(prompts) }
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
      dependencies?: string[];
    }>;
  }> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: AIPrompts.getPlanGenerationSystemPrompt() },
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
        { role: 'system', content: AIPrompts.getTaskCompletionSystemPrompt() },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content || '';
  }
}

export const openaiService = new OpenAIService();