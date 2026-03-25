import type { FailureReason } from './validators'

export interface TelemetryEvent {
  requestId: string
  taskType: string
  model: string
  attempt: number
  success: boolean
  failureReason?: FailureReason
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
}

export function logTelemetry(event: TelemetryEvent) {
  console.log('[llm_execution]', event)
}
