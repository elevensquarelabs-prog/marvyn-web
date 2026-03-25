import type { ExecutionContext } from './context'
import type { TaskPolicy } from './policies'
import { skills } from '@/lib/skills/index'

export interface BuiltPrompt {
  system: string
  user: string
  version: string
}

export function buildPrompt(policy: TaskPolicy, input: string, context: ExecutionContext): BuiltPrompt {
  if (policy.taskType === 'copy_generate') {
    return {
      version: policy.promptVersion,
      system: skills.copywriting,
      user: `[${policy.promptVersion}] Create structured copy for this request.\nComplexity: ${context.complexity}\n\n${input}`,
    }
  }

  return {
    version: policy.promptVersion,
    system: 'You write high-quality marketing blog content. Keep structure clear and readable.',
    user: `[${policy.promptVersion}] Write a blog draft for this request.\nComplexity: ${context.complexity}\n\n${input}`,
  }
}
