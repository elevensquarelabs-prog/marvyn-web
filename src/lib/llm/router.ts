import type { ExecutionContext } from './context'
import type { ModelTier, TaskPolicy } from './policies'

function escalateTier(tier: ModelTier): ModelTier {
  if (tier === 'fast') return 'medium'
  if (tier === 'medium') return 'powerful'
  return 'powerful'
}

export function selectModelTier(policy: TaskPolicy, context: ExecutionContext): ModelTier {
  if (context.retryCount <= 1) return policy.defaultTier
  return escalateTier(policy.defaultTier)
}

export function resolveModelName(tier: ModelTier): string {
  if (tier === 'fast') return 'minimax/minimax-m2.5'
  if (tier === 'medium') return 'anthropic/claude-haiku-4-5'
  return 'anthropic/claude-sonnet-4-6'
}
