export type BasicComplexity = 'low' | 'medium' | 'high'

export interface ExecutionContext {
  retryCount: number
  complexity: BasicComplexity
  inputLength: number
}

export function buildExecutionContext(input: string): ExecutionContext {
  const inputLength = input.trim().length
  let complexity: BasicComplexity = 'low'

  if (inputLength > 1200) complexity = 'high'
  else if (inputLength > 400) complexity = 'medium'

  return {
    retryCount: 0,
    complexity,
    inputLength,
  }
}
