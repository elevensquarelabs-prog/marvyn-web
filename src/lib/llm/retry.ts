import type { FailureReason } from './validators'
import type { ModelTier, TaskPolicy } from './policies'

function escalateTier(tier: ModelTier): ModelTier {
  if (tier === 'fast') return 'medium'
  if (tier === 'medium') return 'powerful'
  return 'powerful'
}

export interface RetryDecision {
  shouldRetry: boolean
  nextTier: ModelTier
}

export function decideRetry(
  attempt: number,
  currentTier: ModelTier,
  policy: TaskPolicy,
  failureReason?: FailureReason
): RetryDecision {
  void failureReason
  if (attempt >= policy.maxRetries) {
    return { shouldRetry: false, nextTier: currentTier }
  }

  if (attempt === 0) {
    return { shouldRetry: true, nextTier: currentTier }
  }

  return { shouldRetry: true, nextTier: escalateTier(currentTier) }
}
