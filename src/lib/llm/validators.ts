import type { TaskPolicy } from './policies'

export type FailureReason = 'empty_output' | 'too_short'

export interface ValidationResult {
  success: boolean
  failureReason?: FailureReason
}

export function validateOutput(output: string, policy: TaskPolicy): ValidationResult {
  const trimmed = output.trim()
  if (!trimmed) {
    return { success: false, failureReason: 'empty_output' }
  }

  if (trimmed.length < policy.minOutputLength) {
    return { success: false, failureReason: 'too_short' }
  }

  return { success: true }
}
