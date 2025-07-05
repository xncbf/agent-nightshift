import Anthropic from '@anthropic-ai/sdk';
import { AIPrompts } from './prompts';

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

    const extractResponse = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [
        { role: 'user', content: AIPrompts.getTaskExtractionUserPrompt(content) }
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
      system: AIPrompts.getTaskAnalysisSystemPrompt(),
      messages: [
        { role: 'user', content: AIPrompts.getTaskAnalysisUserPrompt(prompts) }
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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: AIPrompts.getTaskAnalysisSystemPrompt(),
      messages: [
        { role: 'user', content: AIPrompts.getTaskAnalysisUserPrompt(prompts) }
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
      dependencies?: string[];
    }>;
  }> {
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: AIPrompts.getPlanGenerationSystemPrompt(),
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(responseText);
  }

  async generateCompletion(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: AIPrompts.getTaskCompletionSystemPrompt(),
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}

export const claudeApiService = new ClaudeApiService();