import { TaskNode, LoopConfig } from '../types/workflow'

interface LoopPattern {
  pattern: RegExp
  type: 'until-success' | 'max-attempts'
}

export class LoopDetector {
  private static loopPatterns: LoopPattern[] = [
    // Korean patterns
    { pattern: /실행.*실패.*수정/i, type: 'until-success' },
    { pattern: /테스트.*에러.*수정/i, type: 'until-success' },
    { pattern: /빌드.*실패.*해결/i, type: 'until-success' },
    { pattern: /통과할\s*때까지/i, type: 'until-success' },
    { pattern: /성공할\s*때까지/i, type: 'until-success' },
    { pattern: /반복/i, type: 'max-attempts' },
    { pattern: /재시도/i, type: 'max-attempts' },
    
    // English patterns
    { pattern: /run.*fail.*fix/i, type: 'until-success' },
    { pattern: /test.*error.*fix/i, type: 'until-success' },
    { pattern: /build.*fail.*resolve/i, type: 'until-success' },
    { pattern: /until.*pass/i, type: 'until-success' },
    { pattern: /until.*success/i, type: 'until-success' },
    { pattern: /retry/i, type: 'max-attempts' },
    { pattern: /repeat/i, type: 'max-attempts' },
  ]

  /**
   * Detects potential loops in a sequence of tasks
   */
  static detectLoops(tasks: TaskNode[]): LoopConfig[] {
    const loops: LoopConfig[] = []
    
    // Look for sequential tasks that match loop patterns
    for (let i = 0; i < tasks.length - 1; i++) {
      const currentTask = tasks[i]
      const nextTask = tasks[i + 1]
      
      // Check if these two tasks form a loop pattern
      const combinedText = `${currentTask.title} ${currentTask.description} ${nextTask.title} ${nextTask.description}`
      
      for (const pattern of this.loopPatterns) {
        if (pattern.pattern.test(combinedText)) {
          // Check if there's a third task that completes the loop
          let endTaskIndex = i + 1
          
          // Look for fix/resolve pattern in next 2 tasks
          if (i + 2 < tasks.length) {
            const thirdTask = tasks[i + 2]
            if (this.isFixTask(thirdTask)) {
              endTaskIndex = i + 2
            }
          }
          
          const loopId = `loop-${currentTask.id}-${tasks[endTaskIndex].id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          
          loops.push({
            id: loopId,
            startTaskId: currentTask.id,
            endTaskId: tasks[endTaskIndex].id,
            condition: pattern.type,
            maxAttempts: pattern.type === 'max-attempts' ? 3 : undefined,
            onFailure: 'continue'
          })
          
          // Skip the tasks we've already processed
          i = endTaskIndex
          break
        }
      }
    }
    
    return loops
  }

  /**
   * Checks if a task is a fix/resolve type task
   */
  private static isFixTask(task: TaskNode): boolean {
    const fixPatterns = [
      /fix/i, /resolve/i, /수정/i, /해결/i, /debug/i, /patch/i
    ]
    
    const taskText = `${task.title} ${task.description}`
    return fixPatterns.some(pattern => pattern.test(taskText))
  }

  /**
   * Detects loops from user prompts during task analysis
   */
  static detectLoopsFromPrompts(prompts: string[]): Array<{
    startIndex: number
    endIndex: number
    type: 'until-success' | 'max-attempts'
  }> {
    const loopSuggestions = []
    
    // Check each prompt for explicit loop indicators
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i]
      
      // Check for explicit loop syntax
      if (prompt.includes('[LOOP]') || prompt.includes('반복:')) {
        // Find the end of loop
        let endIndex = i
        for (let j = i + 1; j < prompts.length; j++) {
          if (prompts[j].includes('[/LOOP]') || prompts[j].includes('반복 끝')) {
            endIndex = j
            break
          } else if (j === i + 2) {
            // Default to next 2 tasks if no explicit end
            endIndex = j
            break
          }
        }
        
        loopSuggestions.push({
          startIndex: i,
          endIndex: endIndex,
          type: 'until-success' as const
        })
      }
      
      // Check for implicit patterns
      if (i < prompts.length - 1) {
        const combinedText = `${prompts[i]} ${prompts[i + 1]}`
        for (const pattern of this.loopPatterns) {
          if (pattern.pattern.test(combinedText)) {
            loopSuggestions.push({
              startIndex: i,
              endIndex: Math.min(i + 2, prompts.length - 1),
              type: pattern.type
            })
            break
          }
        }
      }
    }
    
    return loopSuggestions
  }
}