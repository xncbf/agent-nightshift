import { TaskNode, WorkflowPlan } from '../types/workflow'
import { LoopDetector } from './loopDetector'

export class WorkflowAI {
  private addLog: (log: string) => void
  
  constructor(
    addLog: (log: string) => void, 
    aiProvider?: 'openai' | 'claude',
    openaiModel?: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo',
    claudeModel?: 'claude-sonnet-4-0' | 'claude-opus-4-0'
  ) {
    this.addLog = addLog
    // AI parameters are kept for backward compatibility but not used
  }
  
  async analyzeContentAndGenerateWorkflow(content: string): Promise<WorkflowPlan> {
    try {
      this.addLog(`📋 Creating workflow plan...`)
      
      // Always create DAG without AI
      return this.createWorkflowFromContent(content)
    } catch (error) {
      this.addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
  
  private createWorkflowFromContent(content: string): WorkflowPlan {
    // Check if content has workflow markers
    if (this.hasWorkflowMarkers(content)) {
      this.addLog('🎯 Detected workflow markers - creating structured DAG')
      return this.createWorkflowFromMarkers(content)
    }
    
    // Otherwise, create simple task-based workflow
    this.addLog('📝 Creating task-based workflow from content')
    return this.createSimpleWorkflow(content)
  }
  
  private createSimpleWorkflow(content: string): WorkflowPlan {
    const nodes: TaskNode[] = []
    const edges: Array<{ id: string; source: string; target: string }> = []
    
    // Add start node
    nodes.push({
      id: 'start',
      title: 'Start',
      description: 'Workflow start',
      type: 'start',
      status: 'completed',
      position: { x: 250, y: 100 },
      dependencies: []
    })
    
    // Extract tasks from content (split by double newlines)
    const tasks = content.split(/\n\n+/).filter(task => task.trim().length > 0)
    
    // Create nodes for each task (sequential by default)
    let yOffset = 250
    const xPosition = 250
    const taskNodeIds: string[] = []
    let previousNodeId = 'start'
    
    tasks.forEach((task, index) => {
      const nodeId = `task${index + 1}`
      const title = task.trim().substring(0, 50) + (task.trim().length > 50 ? '...' : '')
      
      const node: TaskNode = {
        id: nodeId,
        title: title,
        description: task.trim(),
        type: 'task',
        status: 'pending',
        position: { x: xPosition, y: yOffset },
        duration: 5,
        dependencies: [previousNodeId]
      }
      nodes.push(node)
      taskNodeIds.push(nodeId)
      
      // Connect from previous node (sequential)
      edges.push({
        id: `${previousNodeId}-${nodeId}`,
        source: previousNodeId,
        target: nodeId
      })
      
      previousNodeId = nodeId
      yOffset += 150
    })
    
    // Add end node
    const endNode: TaskNode = {
      id: 'end',
      title: 'Complete',
      description: 'All tasks completed',
      type: 'end',
      status: 'pending',
      position: { x: xPosition, y: yOffset },
      dependencies: previousNodeId ? [previousNodeId] : []
    }
    nodes.push(endNode)
    
    // Connect last task to end
    if (previousNodeId !== 'start') {
      edges.push({
        id: `${previousNodeId}-end`,
        source: previousNodeId,
        target: 'end'
      })
    } else {
      // If no tasks, connect start directly to end
      edges.push({
        id: 'start-end',
        source: 'start',
        target: 'end'
      })
    }
    
    this.addLog(`✅ Created workflow with ${taskNodeIds.length} tasks (sequential execution)`)
    
    return {
      id: `workflow-${Date.now()}`,
      name: 'Task-based Workflow',
      description: 'Workflow created from task list',
      nodes,
      edges,
      status: 'draft',
      createdAt: new Date(),
      estimatedDuration: taskNodeIds.length * 5
    }
  }

  async processLargePrompt(chunks: string[]): Promise<WorkflowPlan> {
    // Simply join chunks and process without AI
    const fullContent = chunks.join('\n\n')
    this.addLog(`📚 Processing ${chunks.length} chunks...`)
    return this.createWorkflowFromContent(fullContent)
  }
  
  private hasWorkflowMarkers(content: string): boolean {
    return content.includes('===sequential===') || 
           content.includes('===parallel===') || 
           content.includes('===parallel-group===')
  }
  
  private createWorkflowFromMarkers(content: string): WorkflowPlan {
    const nodes: TaskNode[] = []
    const edges: Array<{ id: string; source: string; target: string }> = []
    let nodeIdCounter = 1
    
    // Add start node
    nodes.push({
      id: 'start',
      title: 'Start',
      description: 'Workflow start',
      type: 'start',
      status: 'completed',
      position: { x: 100, y: 100 },
      dependencies: []
    })
    
    // Parse the content with markers
    const sections = this.parseMarkerSections(content)
    const { finalNodes, lastNodeIds } = this.processMarkerSections(sections, nodes, edges, nodeIdCounter)
    
    // Calculate end node position
    let maxY = 100
    for (const node of finalNodes) {
      if (node.position && node.position.y > maxY) {
        maxY = node.position.y
      }
    }
    
    // Add end node
    const endNode: TaskNode = {
      id: 'end',
      title: 'Complete',
      description: 'All tasks completed',
      type: 'end',
      status: 'pending',
      position: { x: 250, y: maxY + 150 },
      dependencies: lastNodeIds
    }
    finalNodes.push(endNode)
    
    // Connect last nodes to end
    for (const nodeId of lastNodeIds) {
      edges.push({
        id: `${nodeId}-end`,
        source: nodeId,
        target: 'end'
      })
    }
    
    // Check for loops
    const loops = LoopDetector.detectLoops(finalNodes.filter(n => n.type === 'task'))
    
    return {
      id: `workflow-${Date.now()}`,
      name: 'Marker-based Workflow',
      description: 'Workflow created from structure markers',
      nodes: finalNodes,
      edges,
      loops: loops.length > 0 ? loops : undefined,
      status: 'draft',
      createdAt: new Date(),
      estimatedDuration: (finalNodes.length - 2) * 5 // Exclude start/end nodes
    }
  }
  
  private parseMarkerSections(content: string): any[] {
    const sections: any[] = []
    const lines = content.split('\n')
    let currentSection: any = null
    let currentContent: string[] = []
    let unmarkedContent: string[] = []
    let inParallelGroup = false
    let parallelGroupContent: string[] = []
    
    for (const line of lines) {
      if (line.trim().startsWith('===')) {
        const marker = line.trim()
        
        if (marker === '===parallel-group===') {
          // Start collecting parallel group content
          inParallelGroup = true
          parallelGroupContent = []
          currentSection = null
        } else if (marker === '===end-group===' && inParallelGroup) {
          // End parallel group and save it
          sections.push({
            type: 'parallel-group',
            content: parallelGroupContent.join('\n'),
            subsections: []
          })
          inParallelGroup = false
          parallelGroupContent = []
        } else if (!inParallelGroup) {
          // Normal section processing
          // Save unmarked content as parallel section if exists
          if (!currentSection && unmarkedContent.length > 0 && unmarkedContent.some(l => l.trim())) {
            sections.push({ 
              type: 'parallel', 
              content: unmarkedContent.join('\n').trim(), 
              subsections: [] 
            })
            unmarkedContent = []
          }
          
          // Save previous section if exists
          if (currentSection && currentContent.length > 0) {
            currentSection.content = currentContent.join('\n').trim()
            sections.push(currentSection)
          }
          
          // Start new section
          if (marker === '===sequential===' || marker === '===parallel===') {
            currentSection = { type: marker.replace(/=/g, ''), content: '', subsections: [] }
            currentContent = []
          } else if (marker === '===end===') {
            // Don't push the section again, it was already pushed above
            currentSection = null
            currentContent = []
          }
        }
      } else {
        // Add line to appropriate content
        if (inParallelGroup) {
          parallelGroupContent.push(line)
        } else if (currentSection) {
          currentContent.push(line)
        } else {
          // Content without markers - save for later
          unmarkedContent.push(line)
        }
      }
    }
    
    // Save last section
    if (currentSection && currentContent.length > 0) {
      currentSection.content = currentContent.join('\n').trim()
      sections.push(currentSection)
    }
    
    // Save any remaining unmarked content as parallel
    if (unmarkedContent.length > 0 && unmarkedContent.some(l => l.trim())) {
      sections.push({ 
        type: 'parallel', 
        content: unmarkedContent.join('\n').trim(), 
        subsections: [] 
      })
    }
    
    this.addLog(`📊 Found ${sections.length} sections total`)
    for (const section of sections) {
      this.addLog(`  - Type: ${section.type}, Content length: ${section.content.length}`)
    }
    
    return sections
  }
  
  private processMarkerSections(sections: any[], nodes: TaskNode[], edges: any[], startId: number): { finalNodes: TaskNode[], lastNodeIds: string[] } {
    let nodeIdCounter = startId
    let yOffset = 250
    let lastNodeIds = ['start']
    const allNodes: TaskNode[] = [...nodes]
    
    for (const section of sections) {
      if (section.type === 'parallel') {
        // Process parallel tasks
        const tasks = this.extractTasksFromContent(section.content)
        const parallelNodeIds: string[] = []
        let xOffset = 100
        
        for (const task of tasks) {
          const nodeId = `task${nodeIdCounter++}`
          const node: TaskNode = {
            id: nodeId,
            title: task.title,
            description: task.description,
            type: 'task',
            status: 'pending',
            position: { x: xOffset, y: yOffset },
            duration: 5,
            dependencies: lastNodeIds
          }
          allNodes.push(node)
          
          // Connect from all previous nodes
          for (const prevId of lastNodeIds) {
            edges.push({
              id: `${prevId}-${nodeId}`,
              source: prevId,
              target: nodeId
            })
          }
          
          parallelNodeIds.push(nodeId)
          xOffset += 250
        }
        
        lastNodeIds = parallelNodeIds
        yOffset += 150
        
      } else if (section.type === 'parallel-group') {
        // Process parallel groups (multiple sequential sections in parallel)
        this.addLog(`🔸 Processing parallel-group with content: ${section.content.substring(0, 100)}...`)
        const subsections = this.parseGroupSubsections(section.content)
        const groupLastNodeIds: string[] = []
        let maxYOffset = yOffset
        let xOffset = 100
        
        for (const subsection of subsections) {
          this.addLog(`🔍 Processing subsection: ${subsection.substring(0, 50)}...`)
          const tasks = this.extractTasksFromContent(subsection)
          this.addLog(`📝 Extracted ${tasks.length} tasks`)
          let currentY = yOffset
          
          // First task in each subsection connects to all previous nodes
          if (tasks.length > 0) {
            const firstTask = tasks[0]
            const firstNodeId = `task${nodeIdCounter++}`
            const firstNode: TaskNode = {
              id: firstNodeId,
              title: firstTask.title,
              description: firstTask.description,
              type: 'task',
              status: 'pending',
              position: { x: xOffset, y: currentY },
              duration: 5,
              dependencies: lastNodeIds
            }
            allNodes.push(firstNode)
            
            // Connect from all previous nodes to first task
            for (const prevId of lastNodeIds) {
              edges.push({
                id: `${prevId}-${firstNodeId}`,
                source: prevId,
                target: firstNodeId
              })
            }
            
            let prevNodeId = firstNodeId
            currentY += 150
            
            // Process remaining tasks in the subsection
            for (let i = 1; i < tasks.length; i++) {
              const task = tasks[i]
              const nodeId = `task${nodeIdCounter++}`
              const node: TaskNode = {
                id: nodeId,
                title: task.title,
                description: task.description,
                type: 'task',
                status: 'pending',
                position: { x: xOffset, y: currentY },
                duration: 5,
                dependencies: [prevNodeId]
              }
              allNodes.push(node)
              
              edges.push({
                id: `${prevNodeId}-${nodeId}`,
                source: prevNodeId,
                target: nodeId
              })
              
              prevNodeId = nodeId
              currentY += 150
            }
            
            groupLastNodeIds.push(prevNodeId)
          }
          
          maxYOffset = Math.max(maxYOffset, currentY)
          xOffset += 300
        }
        
        lastNodeIds = groupLastNodeIds
        yOffset = maxYOffset
      }
    }
    
    return { finalNodes: allNodes, lastNodeIds }
  }
  
  private extractTasksFromContent(content: string): Array<{ title: string, description: string }> {
    const tasks: Array<{ title: string, description: string }> = []
    
    // Split by double newlines to separate tasks
    const sections = content.split(/\n\n+/).filter(s => s.trim())
    
    for (const section of sections) {
      const trimmedSection = section.trim()
      // Skip empty sections and marker lines
      if (!trimmedSection || trimmedSection.startsWith('===')) continue
      
      // Each section is a task
      tasks.push({
        title: trimmedSection.substring(0, 50) + (trimmedSection.length > 50 ? '...' : ''),
        description: trimmedSection
      })
    }
    
    // If no tasks found, treat the whole content as one task
    return tasks.length > 0 ? tasks : [{ title: content.substring(0, 50) + '...', description: content }]
  }
  
  private parseGroupSubsections(content: string): string[] {
    const subsections: string[] = []
    const lines = content.split('\n')
    let currentSubsection: string[] = []
    let inSubsection = false
    
    this.addLog(`🔍 Parsing group content (${lines.length} lines):`)
    
    // Check if content has markers
    const hasMarkers = content.includes('===sequential===')
    
    if (hasMarkers) {
      // Original marker-based parsing
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        if (line.trim() === '===sequential===') {
          this.addLog(`  → Found sequential marker at line ${i}`)
          inSubsection = true
          currentSubsection = []
        } else if (line.trim() === '===end===') {
          this.addLog(`  → Found end marker at line ${i}`)
          if (inSubsection && currentSubsection.length > 0) {
            const subsectionContent = currentSubsection.join('\n').trim()
            this.addLog(`📌 Found subsection: ${subsectionContent.substring(0, 50)}...`)
            subsections.push(subsectionContent)
          }
          inSubsection = false
        } else if (inSubsection) {
          currentSubsection.push(line)
        }
      }
    } else {
      // Fallback: split by empty lines
      this.addLog(`  ℹ️ No markers found, splitting by empty lines`)
      let currentGroup: string[] = []
      
      for (const line of lines) {
        if (line.trim()) {
          currentGroup.push(line)
        } else if (currentGroup.length > 0) {
          const groupContent = currentGroup.join('\n').trim()
          subsections.push(groupContent)
          this.addLog(`📌 Found subsection: ${groupContent.substring(0, 50)}...`)
          currentGroup = []
        }
      }
      
      // Add last group if exists
      if (currentGroup.length > 0) {
        const groupContent = currentGroup.join('\n').trim()
        subsections.push(groupContent)
        this.addLog(`📌 Found subsection: ${groupContent.substring(0, 50)}...`)
      }
    }
    
    this.addLog(`✅ Total subsections found: ${subsections.length}`)
    return subsections
  }

  // Note: AI-based methods have been removed as they're no longer needed
  // The workflow creation is now done entirely without AI
}