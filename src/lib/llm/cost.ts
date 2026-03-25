export function estimateCost(params: { inputTokens: number; outputTokens: number }): number {
  const totalTokens = params.inputTokens + params.outputTokens
  return Number(((totalTokens / 1000) * 0.002).toFixed(6))
}
