import { describe, expect, it } from 'vitest'
import { reducer } from '../game/reducer'
import { testGame } from '../game/testUtils'
import type { Action, Game } from '../game/types'
import { soundForChange } from './sounds'

const apply = (g: Game, ...actions: Action[]) => actions.reduce<Game>((h, a) => reducer(h, a)!, g)
const playing = () => apply(testGame(), { type: 'CONTINUE', now: 0 })

// The sound comes from the state change, so it plays the same on the device that tapped and on the other one.
describe('soundForChange', () => {
  it('recognizes each tap', () => {
    const g = playing()
    expect(soundForChange(g, apply(g, { type: 'CORRECT', now: 1 }))).toBe('correct')
    expect(soundForChange(g, apply(g, { type: 'WRONG', now: 1 }))).toBe('wrong')
    expect(soundForChange(g, apply(g, { type: 'PASS', now: 1 }))).toBe('pass')
    expect(soundForChange(testGame(), g)).toBe('turn')
  })

  it('plays pass even on the last pending letter', () => {
    const g = apply(playing(), { type: 'CORRECT', now: 1 }, { type: 'CORRECT', now: 2 }, { type: 'PASS', now: 3 },
      { type: 'CONTINUE', now: 4 }, { type: 'PASS', now: 5 }, { type: 'CONTINUE', now: 6 })
    expect(g.players[0].index).toBe(2)
    expect(soundForChange(g, apply(g, { type: 'PASS', now: 7 }))).toBe('pass')
  })

  it('plays end when the game finishes and nothing on undo, pause, time up or reload', () => {
    const g = apply(playing(), { type: 'WRONG', now: 1 })
    expect(soundForChange(g, apply(g, { type: 'UNDO', now: 2 }))).toBeNull()
    const h = playing()
    expect(soundForChange(h, apply(h, { type: 'PAUSE', now: 1 }))).toBeNull()
    expect(soundForChange(h, apply(h, { type: 'TIME_UP', now: 200_000 }))).toBeNull()
    expect(soundForChange(null, h)).toBeNull()
    const alone = apply(h, { type: 'TIME_UP', now: 200_000 }, { type: 'CONTINUE', now: 200_001 })
    const end = apply(alone, { type: 'TIME_UP', now: 400_000 })
    expect(end.phase).toBe('finished')
    expect(soundForChange(alone, end)).toBe('end')
    expect(soundForChange(end, end)).toBeNull()
  })
})
