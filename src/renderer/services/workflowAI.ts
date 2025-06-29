import { openaiService } from './openaiService'
import { claudeService } from './claudeService'
import { TaskNode, WorkflowPlan } from '../types/workflow'

export class WorkflowAI {
  private addLog: (log: string) => void
  private aiProvider: 'openai' | 'claude-code'
  private openaiModel: string
  
  constructor(
    addLog: (log: string) => void, 
    aiProvider: 'openai' | 'claude-code' = 'openai',
    openaiModel: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo' = 'gpt-4o-mini'
  ) {
    this.addLog = addLog
    this.aiProvider = aiProvider
    this.openaiModel = openaiModel
    
    // Configure OpenAI model if using OpenAI
    if (aiProvider === 'openai') {
      openaiService.setModel(openaiModel)
    }
  }
  
  async analyzeContentAndGenerateWorkflow(content: string): Promise<WorkflowPlan> {
    try {
      this.addLog(`🤔 Analyzing content with ${this.aiProvider === 'openai' ? 'OpenAI' : 'Claude Code'}...`)
      
      // Use the appropriate service based on provider
      const service = this.aiProvider === 'openai' ? openaiService : claudeService
      const analysis = await service.extractAndAnalyzePrompts(content)
      
      if (analysis.tasks.length === 1) {
        // Single task - generate detailed plan
        this.addLog('📝 Creating detailed plan for single task...')
        return await this.analyzePRDAndGenerateWorkflow(analysis.tasks[0].prompt)
      } else {
        // Multiple tasks - use the analyzed structure
        this.addLog(`📊 Found ${analysis.tasks.length} tasks (${analysis.executionType} execution)`)
        return await this.createWorkflowFromAnalysis(analysis)
      }
    } catch (error) {
      this.addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
  
  async analyzePRDAndGenerateWorkflow(prompt: string): Promise<WorkflowPlan> {
    try {
      this.addLog(`🔍 Analyzing prompt with ${this.aiProvider === 'openai' ? 'OpenAI' : 'Claude Code'}...`)
      
      // Use the appropriate service based on provider
      const service = this.aiProvider === 'openai' ? openaiService : claudeService
      const plan = await service.generatePlan(prompt)
      
      this.addLog('📋 Creating workflow plan...')
      const workflowPlan = this.createWorkflowFromPlan(plan)
      
      this.addLog(`✅ Generated workflow with ${workflowPlan.nodes.length} tasks`)
      
      return workflowPlan
    } catch (error) {
      this.addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
  
  private async createWorkflowFromAnalysis(analysis: any): Promise<WorkflowPlan> {
    const nodes: TaskNode[] = [{
      id: 'start',
      title: 'Start',
      description: 'Workflow start',
      type: 'start',
      status: 'completed',
      position: { x: 100, y: 100 },
      dependencies: []
    }]
    
    const edges: Array<{ id: string; source: string; target: string }> = []
    
    // For parallel execution, arrange nodes horizontally
    if (analysis.executionType === 'parallel') {
      let xOffset = 100
      const yPos = 250
      
      for (const task of analysis.tasks) {
        const node: TaskNode = {
          id: task.id,
          title: task.prompt.substring(0, 50) + (task.prompt.length > 50 ? '...' : ''),
          description: task.prompt,
          type: 'task',
          status: 'pending',
          position: { x: xOffset, y: yPos },
          duration: 5,
          dependencies: task.dependencies || []
        }
        nodes.push(node)
        
        // Connect from start
        edges.push({
          id: `start-${node.id}`,
          source: 'start',
          target: node.id
        })
        
        xOffset += 250
      }
      
      // Connect all to end
      const endNode: TaskNode = {
        id: 'end',
        title: 'Complete',
        description: 'All tasks completed',
        type: 'end',
        status: 'pending',
        position: { x: 100 + (analysis.tasks.length - 1) * 125, y: 400 },
        dependencies: analysis.tasks.map((t: any) => t.id)
      }
      nodes.push(endNode)
      
      for (const task of analysis.tasks) {
        edges.push({
          id: `${task.id}-end`,
          source: task.id,
          target: 'end'
        })
      }
    } else {
      // Sequential execution - arrange vertically
      let yOffset = 250
      let prevNodeId = 'start'
      
      for (const task of analysis.tasks) {
        const node: TaskNode = {
          id: task.id,
          title: task.prompt.substring(0, 50) + (task.prompt.length > 50 ? '...' : ''),
          description: task.prompt,
          type: 'task',
          status: 'pending',
          position: { x: 100, y: yOffset },
          duration: 5,
          dependencies: task.dependencies || [prevNodeId]
        }
        nodes.push(node)
        
        edges.push({
          id: `${prevNodeId}-${node.id}`,
          source: prevNodeId,
          target: node.id
        })
        
        prevNodeId = node.id
        yOffset += 150
      }
      
      const endNode: TaskNode = {
        id: 'end',
        title: 'Complete',
        description: 'All tasks completed',
        type: 'end',
        status: 'pending',
        position: { x: 100, y: yOffset },
        dependencies: [prevNodeId]
      }
      nodes.push(endNode)
      
      edges.push({
        id: `${prevNodeId}-end`,
        source: prevNodeId,
        target: 'end'
      })
    }
    
    return {
      id: `workflow-${Date.now()}`,
      name: `${analysis.executionType === 'parallel' ? 'Parallel' : 'Sequential'} Workflow`,
      description: 'Auto-generated workflow from prompts',
      nodes,
      edges,
      status: 'draft',
      createdAt: new Date(),
      estimatedDuration: nodes.length * 5
    }
  }
  
  
  private createWorkflowFromPlan(plan: any): WorkflowPlan {
    const nodes: TaskNode[] = [
      {
        id: 'start',
        title: 'Start',
        description: 'Workflow start',
        type: 'start',
        status: 'completed',
        position: { x: 100, y: 100 },
        dependencies: []
      }
    ]
    
    const edges: Array<{ id: string; source: string; target: string }> = []
    let yOffset = 250
    let prevNodeId = 'start'
    
    for (const task of plan.tasks || []) {
      const node: TaskNode = {
        id: task.id,
        title: task.name,
        description: task.description,
        type: 'task',
        status: 'pending',
        position: { x: 100, y: yOffset },
        duration: 5,
        dependencies: [prevNodeId]
      }
      nodes.push(node)
      
      edges.push({
        id: `${prevNodeId}-${node.id}`,
        source: prevNodeId,
        target: node.id
      })
      
      prevNodeId = node.id
      yOffset += 150
    }
    
    const endNode: TaskNode = {
      id: 'end',
      title: 'Complete',
      description: 'All tasks completed',
      type: 'end',
      status: 'pending',
      position: { x: 100, y: yOffset },
      dependencies: [prevNodeId]
    }
    nodes.push(endNode)
    
    edges.push({
      id: `${prevNodeId}-end`,
      source: prevNodeId,
      target: 'end'
    })
    
    return {
      id: `workflow-${Date.now()}`,
      name: plan.title || 'Workflow',
      description: 'Auto-generated workflow',
      nodes,
      edges,
      status: 'draft',
      createdAt: new Date(),
      estimatedDuration: nodes.length * 5
    }
  }
}