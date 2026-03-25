export type TaskType = 'copy_generate' | 'blog'
export type ModelTier = 'fast' | 'medium' | 'powerful'

export interface TaskPolicy {
  taskType: TaskType
  defaultTier: ModelTier
  promptVersion: string
  requiresStructuredOutput?: boolean
  minOutputLength: number
  maxRetries: number
}

export const TASK_POLICIES: Record<TaskType, TaskPolicy> = {
  copy_generate: {
    taskType: 'copy_generate',
    defaultTier: 'medium',
    promptVersion: 'v1',
    requiresStructuredOutput: true,
    minOutputLength: 120,
    maxRetries: 2,
  },
  blog: {
    taskType: 'blog',
    defaultTier: 'medium',
    promptVersion: 'v1',
    requiresStructuredOutput: false,
    minOutputLength: 300,
    maxRetries: 2,
  },
}

export function getPolicy(taskType: TaskType): TaskPolicy {
  return TASK_POLICIES[taskType]
}
