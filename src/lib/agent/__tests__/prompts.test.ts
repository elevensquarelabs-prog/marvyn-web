import { describe, it, expect } from 'vitest'
import { buildSpecialistPrompt, buildCMOPlanningPrompt, buildCMOReviewPrompt } from '../prompts'
import type { ContextBoard } from '../board'

const minimalBoard: ContextBoard = {
  goal: { userRequest: 'audit my SEO', timeHorizon: '7d', successCriteria: 'identify top 3 issues' },
  contextBundle: { seoAudit: { score: 55 }, brand: { name: 'Acme' } },
  agentHistories: {},
  taskList: [{
    taskId: 't1', agent: 'seo', task: 'audit SEO health',
    priority: 1, domainTags: ['seo'], requestedBy: 'cmo', status: 'pending',
  }],
  agentAttempts: {},
  correctionHistory: {},
  reviewStatus: 'pending',
  tokenUsage: { inputTokens: 0, outputTokens: 0 },
}

describe('buildSpecialistPrompt', () => {
  it('includes brand name', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', 'skills/seo-audit.md content')
    expect(prompt.system).toContain('Acme')
  })

  it('includes the user request', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', '')
    expect(prompt.user).toContain('audit my SEO')
  })

  it('includes the task description', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', '')
    expect(prompt.user).toContain('audit SEO health')
  })

  it('requires JSON output', () => {
    const prompt = buildSpecialistPrompt('seo', minimalBoard, 't1', '')
    expect(prompt.system).toContain('JSON')
  })
})

describe('buildCMOPlanningPrompt', () => {
  it('includes connected integrations list', () => {
    const prompt = buildCMOPlanningPrompt(minimalBoard, ['GSC', 'Meta Ads'], 'cmo skill')
    expect(prompt.user).toContain('GSC')
  })

  it('includes user request', () => {
    const prompt = buildCMOPlanningPrompt(minimalBoard, [], '')
    expect(prompt.user).toContain('audit my SEO')
  })
})

describe('buildCMOReviewPrompt', () => {
  it('includes the agent output to review', () => {
    const boardWithOutput: ContextBoard = {
      ...minimalBoard,
      taskList: [{ ...minimalBoard.taskList[0], status: 'done' }],
      agentAttempts: {
        seo: [{ summary: 'SEO is weak', findings: [], evidence: [], recommendations: [] }],
      },
    }
    const prompt = buildCMOReviewPrompt(boardWithOutput, 'cmo skill')
    expect(prompt.user).toContain('SEO is weak')
  })
})
