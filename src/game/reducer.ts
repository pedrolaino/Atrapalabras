import { config } from '../config'
import { remainingTime } from './clock'
import type { Action, AnswerTap, BoardSnapshot, Game, Player, Question, WheelSlot } from './types'

// Pure function: (game, action) => new game. It never reads the clock or randomness:
// everything it needs comes in the action, so every device reaches the same state.
export function reducer(g: Game | null, a: Action): Game | null {
  // A game in progress is never overwritten: if both players tap Rematch, the first one wins.
  if (a.type === 'START') return g && g.phase !== 'finished' ? g : createGame(a.names, a.wheels, a.timeMs)
  if (a.type === 'RESET') return null
  if (!g) return g

  switch (a.type) {
    case 'CONTINUE':
      if (g.phase !== 'betweenTurns' || (a.turn !== undefined && a.turn !== g.turns)) return g
      return { ...g, phase: 'playing', clockStartedAt: a.now, turns: g.turns + 1, history: [] }

    case 'PAUSE':
      if (!running(g)) return g
      return { ...stopClock(g, a.now), paused: true }

    case 'RESUME':
      if (g.phase !== 'playing' || !g.paused) return g
      return { ...g, paused: false, clockStartedAt: a.now }

    case 'TIME_UP':
      if (!running(g) || remainingTime(g, g.current, a.now) > 0) return g
      return timeUp(g, a.now)

    case 'CORRECT':
    case 'WRONG':
    case 'PASS': {
      if (!running(g) || !isOnScreen(g, a)) return g
      if (remainingTime(g, g.current, a.now) <= 0) return timeUp(g, a.now)
      const history = [...g.history, snapshot(g)].slice(-config.maxUndo)
      return { ...answer(g, a.type, a.now), history }
    }

    case 'UNDO':
      return undo(g, a.now)
  }
}

function createGame(names: [string, string], wheels: [Question[], Question[]], timeMs: number): Game {
  const player = (i: 0 | 1): Player => ({
    name: names[i],
    wheel: wheels[i].map((question) => ({ letter: question.letter, question, status: 'pending' })),
    index: 0,
    remainingMs: timeMs,
    done: false,
  })
  return {
    version: 2,
    players: [player(0), player(1)],
    current: 0,
    phase: 'betweenTurns',
    paused: false,
    clockStartedAt: null,
    handOver: true,
    turns: 0,
    history: [],
  }
}

const running = (g: Game) => g.phase === 'playing' && !g.paused

function isOnScreen(g: Game, t: AnswerTap): boolean {
  const p = g.players[g.current]
  return (t.turn === undefined || t.turn === g.turns) && (t.questionId === undefined || t.questionId === p.wheel[p.index].question.id)
}

function withPlayer(g: Game, i: 0 | 1, p: Player): Game {
  const players: [Player, Player] = [...g.players]
  players[i] = p
  return { ...g, players }
}

// Stops the current player's clock, saving the time left.
function stopClock(g: Game, now: number): Game {
  const p = g.players[g.current]
  return { ...withPlayer(g, g.current, { ...p, remainingMs: remainingTime(g, g.current, now) }), clockStartedAt: null }
}

// Next pending letter after `from`, wrapping around; -1 if there is none left.
function nextPending(wheel: WheelSlot[], from: number): number {
  for (let k = 1; k <= wheel.length; k++) {
    const i = (from + k) % wheel.length
    if (wheel[i].status === 'pending') return i
  }
  return -1
}

// With the clock already stopped: the other player is up if still in play; otherwise the game is over.
function endTurn(g: Game): Game {
  const other = g.current === 0 ? 1 : 0
  if (!g.players[other].done) return { ...g, current: other, phase: 'betweenTurns', handOver: true }
  return { ...g, phase: 'finished' }
}

function answer(g: Game, type: 'CORRECT' | 'WRONG' | 'PASS', now: number): Game {
  const p = g.players[g.current]
  const wheel = p.wheel.map((s, k): WheelSlot =>
    k === p.index && type !== 'PASS' ? { ...s, status: type === 'CORRECT' ? 'correct' : 'wrong' } : s,
  )
  const next = nextPending(wheel, p.index)
  const done = next === -1
  const h = withPlayer(g, g.current, { ...p, wheel, index: done ? p.index : next, done })
  if (done) return endTurn(stopClock(h, now))
  if (type === 'CORRECT') return h
  // If the opponent is already done, the remaining player plays alone: a wrong answer does not
  // end the turn, and passing stops the clock until Continue is tapped.
  if (h.players[h.current === 0 ? 1 : 0].done) {
    return type === 'WRONG' ? h : { ...stopClock(h, now), phase: 'betweenTurns', handOver: false }
  }
  return endTurn(stopClock(h, now))
}

function timeUp(g: Game, now: number): Game {
  const h = stopClock(g, now)
  return endTurn(withPlayer(h, h.current, { ...h.players[h.current], remainingMs: 0, done: true }))
}

function snapshot(g: Game): BoardSnapshot {
  const s = (p: Player) => ({ index: p.index, done: p.done, statuses: p.wheel.map((slot) => slot.status) })
  return { current: g.current, players: [s(g.players[0]), s(g.players[1])] }
}

// Restores the board to how it was before the last tap. It always goes back to "playing",
// with the clock starting now from the time that was left (no time is refunded or charged).
function undo(g: Game, now: number): Game {
  const last = g.history.at(-1)
  if (!last || g.paused) return g
  const stopped = stopClock(g, now)
  const restore = (i: 0 | 1): Player => {
    const p = stopped.players[i]
    const s = last.players[i]
    return { ...p, index: s.index, done: s.done, wheel: p.wheel.map((slot, k) => ({ ...slot, status: s.statuses[k] })) }
  }
  return {
    ...stopped,
    players: [restore(0), restore(1)],
    current: last.current,
    phase: 'playing',
    clockStartedAt: now,
    history: g.history.slice(0, -1),
  }
}
