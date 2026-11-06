import { describe, expect, it } from 'vitest'
import { remainingTime } from './clock'
import { testGame } from './testUtils'

describe('remainingTime', () => {
  it('returns the saved time while the clock is stopped', () => {
    const g = testGame()
    expect(remainingTime(g, 0, 999_999)).toBe(150_000)
  })

  it('subtracts the time elapsed since the clock started', () => {
    const g = { ...testGame(), phase: 'playing' as const, clockStartedAt: 10_000 }
    expect(remainingTime(g, 0, 12_500)).toBe(147_500)
  })

  it('only runs the current player\'s clock', () => {
    const g = { ...testGame(), phase: 'playing' as const, clockStartedAt: 10_000 }
    expect(remainingTime(g, 1, 50_000)).toBe(150_000)
  })

  it('a time before the start does not add time', () => {
    const g = { ...testGame(), phase: 'playing' as const, clockStartedAt: 10_000 }
    expect(remainingTime(g, 0, 9_000)).toBe(150_000)
  })

  it('is never negative', () => {
    const g = { ...testGame(), phase: 'playing' as const, clockStartedAt: 0 }
    expect(remainingTime(g, 0, 1_000_000)).toBe(0)
  })
})
