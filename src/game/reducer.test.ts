import { describe, expect, it } from 'vitest'
import { reducer } from './reducer'
import { testGame, testQuestions } from './testUtils'
import type { Action, Game } from './types'

// Applies the actions in order, failing if any of them clears the game.
function play(g: Game, ...actions: Action[]): Game {
  return actions.reduce<Game>((state, action) => {
    const next = reducer(state, action)
    if (!next) throw new Error(`Action ${action.type} cleared the game`)
    return next
  }, g)
}

const statuses = (g: Game, i: 0 | 1) => g.players[i].wheel.map((s) => s.status)

// Game already started: Juan's turn, clock running since t=1000.
const inPlay = (letters?: string[]) => play(testGame(letters), { type: 'CONTINUE', now: 1000 })

describe('START', () => {
  it('sets up the game waiting for the device to be handed over', () => {
    const g = testGame()
    expect(g.phase).toBe('betweenTurns')
    expect(g.current).toBe(0)
    expect(g.turns).toBe(0)
    expect(g.clockStartedAt).toBeNull()
    expect(g.paused).toBe(false)
    expect(g.history).toEqual([])
    expect(g.handOver).toBe(true)
    expect(g.players.map((p) => p.name)).toEqual(['Juan', 'Pedro'])
    expect(g.players[0].wheel.map((s) => s.letter)).toEqual(['A', 'B', 'C'])
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
    expect(g.players[1].remainingMs).toBe(150_000)
    expect(g.players[1].wheel[0].question.id).toBe('j2-A')
  })

  it('the state is plain JSON', () => {
    const g = play(inPlay(), { type: 'CORRECT', now: 2000 }, { type: 'PASS', now: 3000 })
    expect(JSON.parse(JSON.stringify(g))).toEqual(g)
  })
})

describe('CONTINUE', () => {
  it('starts the current player\'s clock', () => {
    const g = inPlay()
    expect(g.phase).toBe('playing')
    expect(g.clockStartedAt).toBe(1000)
    expect(g.turns).toBe(1)
  })

  it('does nothing while already playing', () => {
    const g = inPlay()
    expect(reducer(g, { type: 'CONTINUE', now: 5000 })).toBe(g)
  })
})

describe('CORRECT', () => {
  it('marks the letter correct, moves to the next one and the clock keeps running', () => {
    const g = play(inPlay(), { type: 'CORRECT', now: 3000 })
    expect(statuses(g, 0)).toEqual(['correct', 'pending', 'pending'])
    expect(g.players[0].index).toBe(1)
    expect(g.phase).toBe('playing')
    expect(g.current).toBe(0)
    expect(g.clockStartedAt).toBe(1000)
    expect(g.players[0].remainingMs).toBe(150_000)
  })

  it('is ignored outside of play', () => {
    const g = testGame()
    expect(reducer(g, { type: 'CORRECT', now: 3000 })).toBe(g)
  })
})

describe('WRONG', () => {
  it('marks the letter wrong, stops the clock and the other player is up', () => {
    const g = play(inPlay(), { type: 'WRONG', now: 11_000 })
    expect(statuses(g, 0)).toEqual(['wrong', 'pending', 'pending'])
    expect(g.players[0].index).toBe(1)
    expect(g.players[0].remainingMs).toBe(140_000)
    expect(g.phase).toBe('betweenTurns')
    expect(g.current).toBe(1)
    expect(g.clockStartedAt).toBeNull()
    expect(g.handOver).toBe(true)
  })
})

describe('PASS', () => {
  it('leaves the letter pending, moves on and the other player is up', () => {
    const g = play(inPlay(), { type: 'PASS', now: 2000 })
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
    expect(g.players[0].index).toBe(1)
    expect(g.phase).toBe('betweenTurns')
    expect(g.current).toBe(1)
  })

  it('pending letters are asked again on the next round, in order', () => {
    let g = play(inPlay(['A', 'B', 'C', 'D']),
      { type: 'PASS', now: 2000 }, // Juan passes A
      { type: 'CONTINUE', now: 3000 },
      { type: 'WRONG', now: 4000 }, // Pedro misses A
      { type: 'CONTINUE', now: 5000 },
      { type: 'CORRECT', now: 6000 }, // Juan gets B
      { type: 'PASS', now: 7000 }, // Juan passes C
    )
    expect(g.players[0].index).toBe(3)
    g = play(g, { type: 'CONTINUE', now: 8000 }, { type: 'WRONG', now: 9000 }, { type: 'CONTINUE', now: 10_000 })
    g = play(g, { type: 'CORRECT', now: 11_000 }) // Juan gets D, goes back to A
    expect(g.players[0].index).toBe(0)
    g = play(g, { type: 'CORRECT', now: 12_000 }) // gets A, skips B (already correct) and goes to C
    expect(g.players[0].index).toBe(2)
  })

  it('with a single pending letter left, the same one is asked next time', () => {
    const g = play(inPlay(['A', 'B']), { type: 'CORRECT', now: 2000 }, { type: 'PASS', now: 3000 })
    expect(g.players[0].index).toBe(1)
  })
})

describe('end of the wheel', () => {
  it('whoever completes the wheel is done and the other player is up', () => {
    const g = play(inPlay(['A', 'B']), { type: 'CORRECT', now: 2000 }, { type: 'CORRECT', now: 5000 })
    expect(g.players[0].done).toBe(true)
    expect(g.players[0].remainingMs).toBe(146_000)
    expect(g.phase).toBe('betweenTurns')
    expect(g.current).toBe(1)
  })

  it('if the other player is done, a wrong answer does not end the remaining player\'s turn', () => {
    let g = play(inPlay(['A', 'B', 'C']),
      { type: 'CORRECT', now: 2000 }, { type: 'CORRECT', now: 3000 }, { type: 'CORRECT', now: 3500 }, // Juan is done
      { type: 'CONTINUE', now: 4000 },
    )
    g = play(g, { type: 'WRONG', now: 6000 })
    expect(g.phase).toBe('playing')
    expect(g.players[1].index).toBe(1)
    expect(g.clockStartedAt).toBe(4000)
  })

  it('if the other player is done, passing stops the clock and waits for Continue, without handing over', () => {
    let g = play(inPlay(['A', 'B']),
      { type: 'CORRECT', now: 2000 }, { type: 'CORRECT', now: 3000 }, // Juan is done
      { type: 'CONTINUE', now: 4000 },
    )
    expect(g.handOver).toBe(true)
    g = play(g, { type: 'PASS', now: 5000 })
    expect(g.phase).toBe('betweenTurns')
    expect(g.current).toBe(1)
    expect(g.handOver).toBe(false)
    expect(g.clockStartedAt).toBeNull()
    expect(g.players[1].remainingMs).toBe(149_000)
    expect(g.players[1].index).toBe(1)
    g = play(g, { type: 'CONTINUE', now: 20_000 })
    expect(g.phase).toBe('playing')
    expect(g.current).toBe(1)
    expect(g.clockStartedAt).toBe(20_000)
  })

  it('the pass of the player left alone can be undone', () => {
    const g = play(inPlay(['A', 'B']),
      { type: 'CORRECT', now: 2000 }, { type: 'CORRECT', now: 3000 },
      { type: 'CONTINUE', now: 4000 },
      { type: 'PASS', now: 5000 },
      { type: 'UNDO', now: 8000 },
    )
    expect(g.phase).toBe('playing')
    expect(g.players[1].index).toBe(0)
    expect(g.players[1].remainingMs).toBe(149_000)
  })

  it('when both players are done, the game is finished', () => {
    const g = play(inPlay(['A']),
      { type: 'CORRECT', now: 2000 },
      { type: 'CONTINUE', now: 3000 },
      { type: 'WRONG', now: 4000 },
    )
    expect(g.phase).toBe('finished')
    expect(g.clockStartedAt).toBeNull()
    expect(g.players[1].remainingMs).toBe(149_000)
    expect(statuses(g, 1)).toEqual(['wrong'])
  })
})

describe('TIME_UP', () => {
  it('is ignored if the player still has time left', () => {
    const g = inPlay()
    expect(reducer(g, { type: 'TIME_UP', now: 5000 })).toBe(g)
  })

  it('leaves the player out of time and done, and the other player is up', () => {
    const g = play(inPlay(), { type: 'TIME_UP', now: 151_000 })
    expect(g.players[0].remainingMs).toBe(0)
    expect(g.players[0].done).toBe(true)
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
    expect(g.phase).toBe('betweenTurns')
    expect(g.current).toBe(1)
  })

  it('a tap that arrives after the time ran out counts as time up', () => {
    const g = play(inPlay(), { type: 'CORRECT', now: 200_000 })
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
    expect(g.players[0].done).toBe(true)
    expect(g.current).toBe(1)
  })

  it('if the other player was already done, the game is finished', () => {
    const g = play(inPlay(['A']),
      { type: 'CORRECT', now: 2000 },
      { type: 'CONTINUE', now: 3000 },
      { type: 'TIME_UP', now: 153_000 },
    )
    expect(g.phase).toBe('finished')
  })
})

describe('PAUSE / RESUME', () => {
  it('pausing freezes the clock and blocks the buttons', () => {
    let g = play(inPlay(), { type: 'PAUSE', now: 6000 })
    expect(g.paused).toBe(true)
    expect(g.clockStartedAt).toBeNull()
    expect(g.players[0].remainingMs).toBe(145_000)
    expect(reducer(g, { type: 'CORRECT', now: 7000 })).toBe(g)
    expect(reducer(g, { type: 'TIME_UP', now: 500_000 })).toBe(g)
    g = play(g, { type: 'RESUME', now: 60_000 })
    expect(g.paused).toBe(false)
    expect(g.clockStartedAt).toBe(60_000)
    expect(g.players[0].remainingMs).toBe(145_000)
  })

  it('can only pause while playing', () => {
    const g = testGame()
    expect(reducer(g, { type: 'PAUSE', now: 1 })).toBe(g)
    expect(reducer(inPlay(), { type: 'RESUME', now: 1 })).toEqual(inPlay())
  })
})

describe('UNDO', () => {
  it('does nothing with no taps to undo', () => {
    const g = inPlay()
    expect(reducer(g, { type: 'UNDO', now: 2000 })).toBe(g)
  })

  it('undoes a correct answer without refunding time', () => {
    const g = play(inPlay(), { type: 'CORRECT', now: 2000 }, { type: 'UNDO', now: 4000 })
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
    expect(g.players[0].index).toBe(0)
    expect(g.phase).toBe('playing')
    expect(g.clockStartedAt).toBe(4000)
    expect(g.players[0].remainingMs).toBe(147_000)
    expect(g.history).toEqual([])
  })

  it('undoes a wrong answer from the between-turns screen and the clock resumes where it stopped', () => {
    const g = play(inPlay(), { type: 'WRONG', now: 11_000 }, { type: 'UNDO', now: 30_000 })
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
    expect(g.phase).toBe('playing')
    expect(g.current).toBe(0)
    expect(g.players[0].remainingMs).toBe(140_000)
    expect(g.clockStartedAt).toBe(30_000)
  })

  it('undoes several taps in a row', () => {
    const g = play(inPlay(),
      { type: 'CORRECT', now: 2000 }, { type: 'CORRECT', now: 3000 },
      { type: 'UNDO', now: 4000 }, { type: 'UNDO', now: 5000 },
    )
    expect(statuses(g, 0)).toEqual(['pending', 'pending', 'pending'])
  })

  it('undoes the last tap of the game', () => {
    const g = play(inPlay(['A']),
      { type: 'CORRECT', now: 2000 },
      { type: 'CONTINUE', now: 3000 },
      { type: 'WRONG', now: 4000 },
      { type: 'UNDO', now: 9000 },
    )
    expect(g.phase).toBe('playing')
    expect(g.current).toBe(1)
    expect(g.players[1].done).toBe(false)
    expect(g.players[1].remainingMs).toBe(149_000)
  })

  it('once the next turn starts, the previous one can no longer be undone', () => {
    const g = play(inPlay(), { type: 'WRONG', now: 2000 }, { type: 'CONTINUE', now: 3000 })
    expect(g.history).toEqual([])
  })

  it('cannot undo while paused', () => {
    const g = play(inPlay(), { type: 'CORRECT', now: 2000 }, { type: 'PAUSE', now: 3000 })
    expect(reducer(g, { type: 'UNDO', now: 4000 })).toBe(g)
  })

  it('keeps at most 30 taps', () => {
    const letters = Array.from({ length: 40 }, (_, i) => `L${i}`)
    const g = play(inPlay(letters), ...Array.from({ length: 35 }, (_, k): Action => ({ type: 'CORRECT', now: 2000 + k })))
    expect(g.history.length).toBe(30)
  })
})

describe('RESET', () => {
  it('clears the game', () => {
    expect(reducer(inPlay(), { type: 'RESET' })).toBeNull()
  })
})

describe('late or repeated taps', () => {
  const currentQuestion = (g: Game) => g.players[g.current].wheel[g.players[g.current].index].question.id

  it('a double tap does not score the next letter', () => {
    const g = inPlay()
    const id = currentQuestion(g)
    const h = play(g, { type: 'CORRECT', now: 2000, questionId: id, turn: 1 }, { type: 'CORRECT', now: 2100, questionId: id, turn: 1 })
    expect(statuses(h, 0)).toEqual(['correct', 'pending', 'pending'])
  })

  it('ignores an answer from a previous turn', () => {
    const g = inPlay(['A'])
    const old = { questionId: currentQuestion(g), turn: g.turns }
    const h = play(g, { type: 'PASS', now: 2000, ...old }, { type: 'CONTINUE', now: 3000 }, { type: 'PASS', now: 4000 }, { type: 'CONTINUE', now: 5000 })
    // It is Juan's same question again, but in another turn
    expect(currentQuestion(h)).toBe(old.questionId)
    expect(play(h, { type: 'WRONG', now: 6000, ...old })).toBe(h)
  })

  it('a Continue from a previous turn does not start the next one', () => {
    const g = play(testGame(), { type: 'CONTINUE', now: 1000, turn: 0 }, { type: 'PASS', now: 2000 })
    expect(g.phase).toBe('betweenTurns')
    expect(play(g, { type: 'CONTINUE', now: 2500, turn: 0 })).toBe(g)
    expect(play(g, { type: 'CONTINUE', now: 2500, turn: 1 }).phase).toBe('playing')
  })

  it('a repeated rematch does not overwrite the game that already started', () => {
    const fresh = testGame()
    const started = play(fresh, { type: 'CONTINUE', now: 1000 })
    const again: Action = { type: 'START', names: ['Juan', 'Pedro'], wheels: [[], []], timeMs: 1 }
    expect(reducer(started, again)).toBe(started)
    expect(reducer(fresh, again)).toBe(fresh)
  })

  it('a rematch does start a new game after the end', () => {
    const finished = play(inPlay(['A']), { type: 'CORRECT', now: 2000 }, { type: 'CONTINUE', now: 3000 }, { type: 'CORRECT', now: 4000 })
    expect(finished.phase).toBe('finished')
    expect(play(finished, { type: 'START', names: ['Juan', 'Pedro'], wheels: [testQuestions(['A'], 'x'), testQuestions(['A'], 'y')], timeMs: 1000 }).phase).toBe('betweenTurns')
  })
})
