import { describe, expect, it } from 'vitest'
import { result, stats } from './scoring'
import { testGame } from './testUtils'
import type { Game, SlotStatus } from './types'

function withStatuses(g: Game, p0: SlotStatus[], p1: SlotStatus[]): Game {
  const apply = (statuses: SlotStatus[], i: 0 | 1) => ({
    ...g.players[i],
    wheel: g.players[i].wheel.map((s, k) => ({ ...s, status: statuses[k] })),
  })
  return { ...g, players: [apply(p0, 0), apply(p1, 1)] }
}

describe('stats', () => {
  it('counts correct, wrong and pending letters', () => {
    const g = withStatuses(testGame(), ['correct', 'wrong', 'pending'], ['correct', 'correct', 'correct'])
    expect(stats(g.players[0])).toEqual({ correct: 1, wrong: 1, pending: 1 })
    expect(stats(g.players[1])).toEqual({ correct: 3, wrong: 0, pending: 0 })
  })
})

describe('result', () => {
  it('the player with more correct answers wins', () => {
    const g = withStatuses(testGame(), ['correct', 'wrong', 'wrong'], ['correct', 'correct', 'wrong'])
    expect(result(g)).toEqual({ winner: 1, reason: 'moreCorrect' })
  })

  it('with the same correct answers, fewer wrong answers wins', () => {
    const g = withStatuses(testGame(), ['correct', 'pending', 'pending'], ['correct', 'wrong', 'pending'])
    expect(result(g)).toEqual({ winner: 0, reason: 'fewerWrong' })
  })

  it('with the same correct and wrong answers, less time used wins', () => {
    const g = withStatuses(testGame(), ['correct', 'wrong', 'pending'], ['wrong', 'pending', 'correct'])
    g.players[0].remainingMs = 40_000
    g.players[1].remainingMs = 52_000
    expect(result(g)).toEqual({ winner: 1, reason: 'lessTime' })
  })

  it('time is compared in seconds, as shown on screen', () => {
    const g = withStatuses(testGame(), ['correct', 'wrong', 'pending'], ['wrong', 'pending', 'correct'])
    g.players[0].remainingMs = 40_100
    g.players[1].remainingMs = 40_900
    expect(result(g)).toEqual({ winner: null, reason: 'tie' })
  })

  it('with the same correct answers, wrong answers and time it is a tie', () => {
    const g = withStatuses(testGame(), ['correct', 'wrong', 'pending'], ['wrong', 'pending', 'correct'])
    expect(result(g)).toEqual({ winner: null, reason: 'tie' })
  })
})
