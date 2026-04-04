import { describe, it, expect } from 'vitest'
import { createBoard } from '../board'

describe('createBoard', () => {
  it('sets goal fields from input', () => {
    const board = createBoard({
      userRequest: 'audit my SEO',
      timeHorizon: '7d',
      selectedAgent: 'seo',
    })
    expect(board.goal.userRequest).toBe('audit my SEO')
    expect(board.goal.timeHorizon).toBe('7d')
    expect(board.goal.selectedAgent).toBe('seo')
  })

  it('initialises empty collections', () => {
    const board = createBoard({ userRequest: 'test' })
    expect(board.taskList).toEqual([])
    expect(board.agentAttempts).toEqual({})
    expect(board.correctionHistory).toEqual({})
    expect(board.reviewStatus).toBe('pending')
  })

  it('contextBundle and agentHistories start empty', () => {
    const board = createBoard({ userRequest: 'test' })
    expect(board.contextBundle).toEqual({})
    expect(board.agentHistories).toEqual({})
  })
})
