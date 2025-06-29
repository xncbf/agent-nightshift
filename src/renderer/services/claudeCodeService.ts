import { WorkflowPlan, TaskNode, TaskEdge } from '../types/workflow'
import { WorkflowAI } from './workflowAI'

// Enhanced Claude Code MCP service with AI integration
export class ClaudeCodeService {
  private workflowAI: WorkflowAI

  constructor() {
    this.workflowAI = new WorkflowAI()
  }

  async analyzePRD(prd: string): Promise<WorkflowPlan> {
    try {
      // Use AI-powered workflow generation
      const aiWorkflow = await this.workflowAI.analyzePRDAndGenerateWorkflow(prd)
      return aiWorkflow
    } catch (error) {
      console.error('AI workflow generation failed, using fallback:', error)
      // Fallback to rule-based generation
      await new Promise(resolve => setTimeout(resolve, 2000))
      return this.generateWorkflowPlan(prd)
    }
  }

  private generateWorkflowPlan(prd: string): WorkflowPlan {
    const plan: WorkflowPlan = {
      id: Date.now().toString(),
      name: this.extractProjectName(prd),
      description: `Automated development plan for: ${this.extractProjectName(prd)}`,
      nodes: this.generateTasks(prd),
      edges: [],
      status: 'draft',
      createdAt: new Date(),
      estimatedDuration: 0
    }

    // Generate edges based on task dependencies
    plan.edges = this.generateEdges(plan.nodes)
    plan.estimatedDuration = this.calculateEstimatedDuration(plan.nodes)

    return plan
  }

  private extractProjectName(prd: string): string {
    // Extract title from markdown-style PRD
    const lines = prd.split('\n')
    for (const line of lines) {
      if (line.startsWith('#')) {
        return line.replace(/^#+\s*/, '').trim()
      }
    }
    return 'Untitled Project'
  }

  private generateTasks(prd: string): TaskNode[] {
    const tasks: TaskNode[] = []
    let yPos = 100

    // Start node
    tasks.push({
      id: 'start',
      type: 'start',
      title: 'Start',
      description: 'Project initialization',
      status: 'completed',
      dependencies: [],
      position: { x: 200, y: yPos }
    })

    yPos += 120

    // Analyze PRD content to determine tasks
    const isReactProject = prd.toLowerCase().includes('react')
    const hasAuth = prd.toLowerCase().includes('auth')
    const hasDatabase = prd.toLowerCase().includes('database') || prd.toLowerCase().includes('firebase')
    const hasTesting = prd.toLowerCase().includes('test')
    const hasCharts = prd.toLowerCase().includes('chart') || prd.toLowerCase().includes('dashboard')

    // Setup tasks
    tasks.push({
      id: 'setup-project',
      type: 'task',
      title: 'Setup Project',
      description: 'Initialize project structure and dependencies',
      status: 'pending',
      duration: 5,
      dependencies: ['start'],
      position: { x: 200, y: yPos }
    })

    yPos += 120

    if (isReactProject) {
      tasks.push({
        id: 'setup-react',
        type: 'task',
        title: 'Setup React',
        description: 'Configure React application and routing',
        status: 'pending',
        duration: 10,
        dependencies: ['setup-project'],
        position: { x: 200, y: yPos }
      })
      yPos += 120
    }

    // Parallel tasks
    let xOffset = 0
    const parallelTasks = []

    if (hasAuth) {
      parallelTasks.push({
        id: 'implement-auth',
        type: 'task',
        title: 'User Authentication',
        description: 'Implement login, signup, and session management',
        status: 'pending',
        duration: 30,
        dependencies: isReactProject ? ['setup-react'] : ['setup-project'],
        position: { x: 50 + xOffset, y: yPos }
      })
      xOffset += 200
    }

    if (hasCharts) {
      parallelTasks.push({
        id: 'implement-dashboard',
        type: 'task',
        title: 'Dashboard & Charts',
        description: 'Create data visualization and dashboard',
        status: 'pending',
        duration: 25,
        dependencies: isReactProject ? ['setup-react'] : ['setup-project'],
        position: { x: 50 + xOffset, y: yPos }
      })
      xOffset += 200
    }

    if (hasDatabase) {
      parallelTasks.push({
        id: 'setup-database',
        type: 'task',
        title: 'Database Setup',
        description: 'Configure database and data models',
        status: 'pending',
        duration: 20,
        dependencies: isReactProject ? ['setup-react'] : ['setup-project'],
        position: { x: 50 + xOffset, y: yPos }
      })
    }

    tasks.push(...parallelTasks)
    yPos += 120

    // Integration and testing
    const integrationDeps = parallelTasks.map(task => task.id)
    
    tasks.push({
      id: 'integration',
      type: 'task',
      title: 'Integration',
      description: 'Integrate all components and features',
      status: 'pending',
      duration: 15,
      dependencies: integrationDeps.length > 0 ? integrationDeps : ['setup-project'],
      position: { x: 200, y: yPos }
    })

    yPos += 120

    if (hasTesting) {
      tasks.push({
        id: 'testing',
        type: 'task',
        title: 'Testing',
        description: 'Write and run tests',
        status: 'pending',
        duration: 20,
        dependencies: ['integration'],
        position: { x: 200, y: yPos }
      })
      yPos += 120
    }

    // Build and deploy
    tasks.push({
      id: 'build-deploy',
      type: 'task',
      title: 'Build & Deploy',
      description: 'Build application and prepare for deployment',
      status: 'pending',
      duration: 10,
      dependencies: hasTesting ? ['testing'] : ['integration'],
      position: { x: 200, y: yPos }
    })

    yPos += 120

    // End node
    tasks.push({
      id: 'end',
      type: 'end',
      title: 'Complete',
      description: 'Project completed successfully',
      status: 'pending',
      dependencies: ['build-deploy'],
      position: { x: 200, y: yPos }
    })

    return tasks
  }

  private generateEdges(nodes: TaskNode[]): TaskEdge[] {
    const edges: TaskEdge[] = []
    
    nodes.forEach(node => {
      node.dependencies.forEach(depId => {
        edges.push({
          id: `${depId}-${node.id}`,
          source: depId,
          target: node.id,
          type: 'default'
        })
      })
    })

    return edges
  }

  private calculateEstimatedDuration(nodes: TaskNode[]): number {
    return nodes.reduce((total, node) => total + (node.duration || 0), 0)
  }

  async executeWorkflow(plan: WorkflowPlan): Promise<void> {
    // This would integrate with actual Claude Code MCP
    console.log('Executing workflow:', plan)
    
    // For now, simulate execution
    // In real implementation, this would:
    // 1. Send PRD to Claude Code via MCP
    // 2. Monitor execution progress
    // 3. Update task statuses in real-time
  }
}